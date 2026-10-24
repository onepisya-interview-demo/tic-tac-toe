# 票 18：探针修复票（probe-repair）

- 日期: 2026-10-09
- 状态: executing
- 立项依据: 主公 2026-10-09 会话裁决——『我觉得可以 立一张探针修复票』＋低危勘误『我觉得应该修』（并入本票）
- 来源: 验证基建路线图 17 票执行波的 verified 评审发现（探针修复债无主）＋票 15 白名单遗留＋票 14 已勘误声称失真

## 目标

KNOWN_STALE 七支常红探针按烧退纪律清账（verify-all.mjs:21 原文：对应探针修复票落地时必须删除条目）；offline-mode-qa 补写检测面；票 15 白名单 53 行裸真值终态；三条低危勘误。

## 范围与红因（源：scripts/verify-all.mjs KNOWN_STALE_PROBES 注记）

1. **入口漂移族 5 支**（audio-probe / audio-cheer / audio-confetti-qa / confetti-origin-qa / hydration-check）：末次维护 d07fd07（09-19），同日后 c75cfdf/c9ef27f 上线 RoomGateDialog＋online 入口拦截，start-online 不再直达 /online（waitForURL 超时）——探针导航序列未跟进。
2. **pwa-sw-cache-qa**：探针 2a49b4d（09-11）硬编码缓存名 tic-tac-toe-v1；sw 缓存版本化 a380404（09-22）后 CACHE_NAME=tic-tac-toe-v<app 版本>（现 v0.1.0）。
3. **ux-qa**：RoomGateDialog（c75cfdf）拦截首页点击，before/after 两相位均被挡。
4. **offline-mode-qa 检测面**（票 14 发现）：零写检测面只盯已退役 /api/stats 链，对现行 /api/rooms/** 写放行。
5. **53 行裸真值**：票 15 白名单台账（.omo/evidence/ 票 15 证据件）在档的 assert.ok 裸真值，终态＝重写字面期望 / 删除 / 注理由。
6. **三条勘误**：docs/verify-tic-tac-toe.md 探针清单「减 3」→「减 4」；KNOWN_STALE 清账后层⑥语义（探针全绿）记入 docs/verification-gauntlet.md 真源；scripts/verify-all.mjs hermetic 未就绪路径「基线转绿 20」算术误报修正。

## 红线

- **断言不许弱化**：修的是探针过时面（导航序列/缓存名/检测面），不是断言强度；任何放宽须业务理由留注释，否则不许动。
- **修探针侧不改业务侧**：红因若是业务回归须 escalate 另立票，不在本票内改业务代码。
- 退役须注理由；L0 硬约束沿用（AGENTS.md）；不 push；决策文件与 .omo/evidence/ 不 commit。

## 验收（机械判据）

1. `node scripts/verify-all.mjs` exit 0 且探针汇总行无 known-stale FAIL（终态 20/20 PASS，或退役项从 PROBES 清单移除并注理由）。
2. KNOWN_STALE_PROBES 条目按烧退纪律删除（grep 计 0 或仅剩注理由退役说明）。
3. 六层绿：`pnpm vitest run` / `pnpm typecheck` / `pnpm lint` / `pnpm build` / `node tests/qa/commit-audit.mjs --range origin/main..HEAD`。
4. 53 行裸真值终态：复扫归零或白名单逐条注理由。
5. 三条勘误文件断言命中。
6. 生产冒烟探针无回退（`node tests/qa/prod-smoke.mjs` exit 0）。
7. 回执写回决策文件（立项指针＋完成回执）。
