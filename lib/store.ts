'use client';

import { create } from 'zustand';
import {
  applyMove,
  checkWinner,
  createEmptyBoard,
  emptyStats,
  isBoardFull,
  otherPlayer,
  randomizeFirstPlayer,
  recordOutcome,
  type Board,
  type GameStats,
  type Player,
} from './game';
import {
  clearOfflineStats,
  loadOfflineStats,
  persistOfflineStats,
} from './offline-stats';
import { postOutcome } from './game-net';
import {
  clearRoomName as clearRoomNameLocal,
  cleanupLegacyPlayerNameKey,
  getRoomName,
  setRoomName as setRoomNameLocal,
} from './room-name';
import { playSound } from './sound';

export type GamePhase = 'idle' | 'playing' | 'won' | 'drawn';

/**
 * 'online' — 实时上服版本（W2 /online 路由：需 room 入口拦截，完局
 *   通过 lib/game-net.ts → service `recordOutcomeForRoom` 服务端权威
 *   累加）。
 * 'offline' — 离线单机版本（W4 /offline 路由：完全离线、本地账本、
 *   **无条件记账**、合并弹框是唯一网络写）。
 *
 * 差异仅记账路径：online 走 service，offline 走 localStorage
 * (`lib/offline-stats.ts`)。**online 分支遵守「无名不记」守卫**（无名不
 * 发请求——anti-silent-create 纵深防御）；**offline 分支无条件记账**
 * （D-1 语义变更：本机账本不依赖用户填名，回首页瞬间 HomeDialogMount
 * 弹框自然引导同步与建房）。
 */
export type GameMode = 'online' | 'offline';

export interface GameState {
  phase: GamePhase;
  /** Game mode of the current session. */
  mode: GameMode;
  board: Board;
  currentPlayer: Player | null;
  winner: Player | null;
  winLine: readonly [number, number, number] | null;
  /**
   * Room name (mirror of `localStorage['ttt.room.name.v1']`).
   * Hydrated on mount by `setRoomName` (the source of truth) and
   * updated by RoomGateDialog / SyncConfirmDialog on save / clear.
   *
   * **online 分支无名不记守卫** (AC A4 前置): `makeMove` 内首句
   * 判断 `roomName` 是否为空；为 online 时为空则**不发任何请
   * 求**（anti-silent-create 纵深防御——未知名 POST outcome 必
   * 404，守卫避免客户端发出注定失败的请求）。offline 分支无视
   * roomName 无条件 `recordOutcome + persistOfflineStats`（D-1 语
   * 义变更：本机账本不依赖填名；回首页 HomeDialogMount 弹框自然
   * 引导同步与建房）。本步 phase / board 推进不受守卫影响。
   *
   * W2 ulw-room-migration-home-landing §1: `playerName` →
   * `roomName`; `ttt.player.name.v1` → `ttt.room.name.v1` (the
   * pre-rename spellings are retired). The legacy key (if present
   * on a pre-migration browser) is dropped on the first hydrate —
   * D-4 permits clearing without migration.
   */
  roomName: string | null;
  /**
   * 案② c: 最近一次 online 记局失败的提示（非 null 时由
   * OutcomeErrorBanner 渲染 Alert，含 reason + at 时间戳；
   * 清空点 = startGame（新局）/ restart（重启）/ setOutcomeError(null)（user 主动关闭）。
   * makeMove 成功路径不写 outcomeError；won/drawn 后 phase 锁死, makeMove 不再被调用。
   * 旧实现里 r.ok === false 时静默 return, 用户不知战报未上服,
   * /result 会渲染旧行——本字段是该静默路径的可见化。
   */
  outcomeError: { reason: string; at: number } | null;
}

export interface GameActions {
  /**
   * Start a new game. Defaults to 'online'. Starting in 'offline' seeds
   * the internal stats cache from the localStorage baseline (reload
   * semantics) so offline accumulation continues across sessions.
   */
  startGame: (mode?: GameMode) => void;
  /**
   * Apply a move for the current player. Synchronous from the UI
   * perspective — bookkeeping (network write for online, localStorage
   * persistence for offline) happens inside the action but is fire-and-
   * forget for offline (no return promise needed) and stays as a TODO
   * seam for online (W2 wires the actual fetch).
   */
  makeMove: (index: number) => Promise<void>;
  restart: () => void;
  /**
   * Clear the offline-mode stats: remove the localStorage key and reset
   * the internal cache to emptyStats().
   */
  resetOfflineStats: () => void;
  __resetInternalForTests: () => void;
  /**
   * Read-only handle for the module-level internalStats cache. Tests
   * use it to assert offline accumulation.
   */
  __getInternalForTests: () => GameStats;
  /**
   * Set / clear the room name. Persists to localStorage and mirrors
   * the value into state so the store can branch on it without re-reading
   * localStorage at every move. SSR-safe via lib/room-name.ts's window
   * guard. Legacy `ttt.player.name.v1` is cleared on every successful
   * write / read (D-4).
   */
  setRoomName: (name: string | null) => void;
  /**
   * W-F (ulw-online-reset-and-result-fresh D-6): resolve after the
   * in-flight online outcome write (if any) settles. Swallows
   * rejection on purpose — a failed write must not block navigation;
   * `/result` then renders the server's real state at that moment,
   * identical to the old fire-and-forget behavior. No pending write →
   * resolves immediately.
   */
  awaitOutcomeWrite: () => Promise<void>;
  /**
   * 案② c: dismiss / refresh outcomeError. Pass null to clear.
   * 调用方清单见函数体内注释 — 收敛状态翻转单点。
   */
  setOutcomeError: (e: { reason: string; at: number } | null) => void;
}

export type GameStore = GameState & GameActions;

const initial: GameState = {
  phase: 'idle',
  mode: 'online',
  board: createEmptyBoard(),
  currentPlayer: null,
  winner: null,
  winLine: null,
  roomName: null,
  outcomeError: null,
};

// Internal stats cache (NOT in GameState type). For offline mode,
// mirrors the last-known localStorage row; online mode mirrors the
// server-side per-room row via fetch response.
let internalStats: GameStats = emptyStats();

// W-F (ulw-online-reset-and-result-fresh D-6): outcome write seam.
// **为何 module-level**：与上方 internalStats 同款先例——seam 的生命
// 周期跨组件树（写在 store action 内发起，读在任意挂载的
// ResultNavigator），与 React 渲染无关；放进 GameState 得为纯调度
// 状态多跑一次 setState。store 是浏览器内单例（AGENTS §代码地图），
// module-level 变量即天然单例。
let pendingOutcomeWrite: Promise<unknown> | null = null;

/**
 * W-F seam 读侧：当前是否有在途的 online 记局写。ResultNavigator 在
 * push `/result` 前探测——有在途写才 await；无在途写（offline /
 * anonymous-online）保持同步 push，与旧 fire-and-forget 行为零差异。
 *
 * W-RV P2 #3：sanctioned consumer 仅 `components/ResultNavigator.tsx`
 * （push `/result` 前 await 在途写，W-F D-6）。测试面 `tests/store/store.test.ts`
 * 也读此函数（seam 三态断言）。其他模块若新增调用方需审 seam 契约——
 * module-level 单例跨组件树，生命周期不与 React 渲染同步（参见
 * `pendingOutcomeWrite` 上方注释）。
 *
 * 勿为新调用方暴露：seam 是写入 `lib/store.ts:makeMove` online 分支
 * 的内部状态；外部读路径会绕过 ResultNavigator 的卸载 guard，可能
 * 在 push 后撞 `setState on unmounted` 类风险。
 */
export function hasPendingOutcomeWrite(): boolean {
  return pendingOutcomeWrite !== null;
}

/**
 * Tagged result for store-internal network writes. Kept for the
 * online branch; the { ok, reason } shape matches lib/game-net.ts.
 */
export type StoreFetchResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'aborted' | 'network-error' | 'http-error' | 'not-found'; status?: number };

/**
 * Wrap a fetch() call so it rejects (well, returns ok:false) after
 * `ms` milliseconds. Uses AbortController + setTimeout — the pattern
 * the game-net / store helpers already use. 8000 ms is the chosen
 * floor: a single stuck request that blocks the UI for half a minute
 * is what we're guarding against.
 */
export const NETWORK_TIMEOUT_MS = 8000;

export async function withTimeout(
  url: string,
  init: RequestInit,
  ms: number = NETWORK_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException('aborted', 'TimeoutError'));
  }, ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Online-mode outcome recorder seam.
 *
 * Server-authoritative contract: client only names the winner; service
 * `recordOutcomeForRoom(room, outcome)` (lib/db.ts) reads the per-room
 * row, applies `recordOutcome`, upserts, returns the new full row.
 * The 404 from the server maps to `reason: 'not-found'` so callers
 * can branch on the row-vanished case without inspecting status
 * codes. Other failures keep the same reason strings the rest of
 * lib/store.ts's network layer uses ('aborted' / 'network-error' /
 * 'http-error').
 */
async function apiRecordOutcome(
  room: string,
  outcome: 'X' | 'O' | 'draw',
): Promise<StoreFetchResult<{ stats: GameStats }>> {
  const r = await postOutcome(room, outcome);
  if (!r.ok) {
    if (r.reason === 'http-error' && r.status === 404) {
      return { ok: false, reason: 'not-found' };
    }
    return { ok: false, reason: r.reason };
  }
  return { ok: true, value: r.value };
}

/**
 * W-F seam 写侧：把在途 apiRecordOutcome promise 记入 seam，供
 * ResultNavigator 在 push /result 前 await。落定即清（成败皆清）；
 * 自等值校验：restart 后第二局可在第一局写仍挂起时再落一子链，
 * 只有最新 seam 才许清空。`.catch` 把链上 promise 标记为已处理——
 * apiRecordOutcome 契约上不 reject（postOutcome 全 catch），此处
 * 防御未来回归把 unhandled rejection 泄进浏览器。
 */
function trackOutcomeWrite(
  write: Promise<StoreFetchResult<{ stats: GameStats }>>,
): Promise<StoreFetchResult<{ stats: GameStats }>> {
  const seam: Promise<unknown> = write.finally(() => {
    if (pendingOutcomeWrite === seam) {
      pendingOutcomeWrite = null;
    }
  });
  seam.catch(() => {});
  pendingOutcomeWrite = seam;
  return write;
}

export const useGameStore = create<GameStore>((set) => ({
  ...initial,

  __resetInternalForTests: () => {
    internalStats = emptyStats();
    // W-F seam：一并丢弃在途记局写，测试从确定的「无 pending」态起跑
    //（deferred fetch mock 否则会让 seam 跨测试保持挂起）。
    pendingOutcomeWrite = null;
  },

  __getInternalForTests: () => internalStats,

  startGame: (mode?: GameMode) => {
    const resolvedMode: GameMode = mode ?? 'online';
    if (resolvedMode === 'offline') {
      // Reload semantics: an offline session resumes from the browser-
      // persisted baseline so accumulation survives page reloads.
      // W-RV P3 #10: 本分支读 localStorage 是同步的浏览器路径假设——
      // 调用方都在浏览器同步栈内（RestartButton、StartGameButton
      // onClick、PlayController 重启链），不走 SSR / 测试态。
      // 若未来 startGame('offline') 被异步/SSR 路径触发，需先把
      // localStorage 读移到 mount effect（AGENTS §本项目反模式
      // 「localStorage 只在 mount effect 读」只放宽到了 offline
      // 重启分支，因为这条分支语义就是「重置就加载离线账本」）。
      internalStats = loadOfflineStats();
      // Rehydrate the room name from localStorage when the store
      // booted without one (SSR first frame, fresh page navigation,
      // or first home-return after the room-name migration landed).
      if (!useGameStore.getState().roomName) {
        const stored = getRoomName();
        if (stored) {
          // Direct set — mirrors the localStorage value into state so
          // subsequent player moves in this game see it.
          useGameStore.setState({ roomName: stored });
        }
      }
    }
    const firstPlayer = randomizeFirstPlayer();
    set({
      phase: 'playing',
      board: createEmptyBoard(),
      currentPlayer: firstPlayer,
      winner: null,
      winLine: null,
      mode: resolvedMode,
      outcomeError: null, // 案② c: 新局清旧失败提示
    });
  },

  makeMove: async (index: number): Promise<void> => {
    const s = useGameStore.getState();
    if (s.phase !== 'playing') return;
    if (s.currentPlayer === null) return;
    if (s.board[index] !== null) return;

    // **online 分支无名不记守卫** (AC A4 前置 / anti-silent-create 纵
    // 深防御)：仅当 online 且 roomName 为空时跳过 bookkeeping——
    // 客户端避免发出注定 404 的 POST outcome。**offline 分支无条
    // 件记账**（D-1 语义变更）：本机账本不依赖填名。本步 phase /
    // board 推进不受守卫影响。
    const isAnonymous = s.roomName === null || s.roomName === '';

    const board = applyMove(s.board, index, s.currentPlayer);

    const win = checkWinner(board);
    if (win) {
      set({
        board,
        phase: 'won',
        winner: win.player,
        winLine: win.line,
      });
      playSound('win');
      // Two-layer celebration: short ascending pair to confirm the win,
      // then a longer arpeggio with vibrato to celebrate it. The 360ms
      // delay lines up with the end of the 'win' envelopes (2 × 180ms).
      setTimeout(() => playSound('cheer'), 360);
      // online 分支守卫保留；offline 分支无条件记账（D-1 语义变更）
      if (isAnonymous && s.mode === 'online') {
        return;
      }
      if (s.mode === 'offline') {
        // Offline: 100% 本地累加 + localStorage 持久化。零网络写。
        internalStats = recordOutcome(internalStats, win.player);
        persistOfflineStats(internalStats);
        return;
      }
      // Online: POST /api/rooms/{room}/stats/outcomes →
      // lib/db.ts:recordOutcomeForRoom. The server-authoritative row
      // mirrors back into internalStats so the next /result render
      // sees the latest numbers without a second fetch.
      // W-F：同时在途写登记进 seam（trackOutcomeWrite），供
      // ResultNavigator push /result 前等待落定。
      const r = await trackOutcomeWrite(
        apiRecordOutcome(s.roomName as string, win.player),
      );
      if (r.ok) {
        internalStats = r.value.stats;
      } else {
        // 案② c: 失败不再吞, 用 outcomeError 通知 user。phase / board
        // 推进保持, user 看得到胜利也看得到上服未落定。
        set({ outcomeError: { reason: r.reason, at: Date.now() } });
      }
      return;
    }

    if (isBoardFull(board)) {
      set({
        board,
        phase: 'drawn',
        winner: null,
        winLine: null,
      });
      playSound('draw');
      // online 分支守卫保留；offline 分支无条件记账（D-1 语义变更）
      if (isAnonymous && s.mode === 'online') {
        return;
      }
      if (s.mode === 'offline') {
        internalStats = recordOutcome(internalStats, 'draw');
        persistOfflineStats(internalStats);
        return;
      }
      // W-F：同 win 分支——在途写登记进 seam（成败皆落定后清）。
      const r = await trackOutcomeWrite(apiRecordOutcome(s.roomName as string, 'draw'));
      if (r.ok) {
        internalStats = r.value.stats;
      } else {
        // 案② c: 同 win 分支 — outcomeError 兜底
        set({ outcomeError: { reason: r.reason, at: Date.now() } });
      }
      return;
    }

    set({
      board,
      currentPlayer: otherPlayer(s.currentPlayer),
    });
    playSound('move');
  },

  restart: () => {
    set({
      phase: 'idle',
      board: createEmptyBoard(),
      currentPlayer: null,
      winner: null,
      winLine: null,
      outcomeError: null, // 案② c: 重启清旧失败提示
    });
  },

  resetOfflineStats: () => {
    // Defensive guard: resetOfflineStats is offline-mode-only. The sole
    // current caller is components/ResetStatsButton (scope='local',
    // rendered only by OfflineStatsPanel → /offline), so this branch
    // is unreachable in production today. It is added so a future
    // caller that forgets to gate on mode cannot silently wipe the
    // online internal cache (which mirrors the server-row) with
    // emptyStats().
    if (useGameStore.getState().mode !== 'offline') return;
    clearOfflineStats();
    internalStats = emptyStats();
  },

  setRoomName: (name) => {
    // Mirror to localStorage so reloads re-hydrate the same value. Pass
    // null to clear. SSR-safe via the inner typeof window guard in
    // lib/room-name.ts.
    //
    // W2 (D-4): every successful write runs cleanupLegacyPlayerNameKey
    // so the user cannot end up with both keys present after they
    // switched rooms. The legacy key is also dropped on read (via
    // getRoomName's side-effect); this double-cleanup is belt-and-
    // suspenders, not duplication of intent.
    cleanupLegacyPlayerNameKey();
    if (name === null) {
      clearRoomNameLocal();
    } else {
      setRoomNameLocal(name);
    }
    set({ roomName: name });
  },

  awaitOutcomeWrite: async () => {
    const pending = pendingOutcomeWrite;
    if (pending === null) return;
    try {
      await pending;
    } catch {
      // 吞错（D-6 拍板语义）：写失败也算落定。导航不能被记局失败
      // 卡死——/result 会渲染服务端当时真实状态，与旧 fire-and-forget
      // 行为零回退。现网 apiRecordOutcome 契约上不 reject
      // （postOutcome 全 catch），此 catch 是对未来的防御。
    }
  },

  setOutcomeError: (e) => {
    // 案② c: 单点翻转 outcomeError 状态；调用方: OutcomeErrorBanner
    // 关闭按钮、__resetInternalForTests、startGame / restart (见上)。
    // store 是浏览器内单例 (AGENTS §代码地图), set 直接命中共享 state。
    set({ outcomeError: e });
  },
}));
