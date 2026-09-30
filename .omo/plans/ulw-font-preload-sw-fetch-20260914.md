# ulw: 字体 preload 警告 + SW 网络错误噪音 修复计划

- 日期: 2026-09-14
- 状态: 已实现（fa76a39 2026-09-14 fix(sw) Fix A/B 与 sw-console-hygiene 探针同票落地；状态线 2026-09-26 按 git 实况修正）
- 分支: main（trunk-based，单修复者串行写入）
- 来源: 主公线上报告（3t.onepis.net / 3t-tic-tac-toe.vercel.app 控制台警告）

## 一、根因（已实证，证据链见下）

### 病甲 — "preloaded using link preload but not used" 字体警告
1. `/` 响应头带 `Link: </_next/static/immutable/media/caa3a2e1cccd8315-s.p.0zr6hhvz-h9nw.woff2>; rel=preload; as="font"`；`/play` HTML 头带同 URL `<link rel=preload as=font crossorigin>`。文件名 `.p.` = next/font 的 preload 标记（`app/layout.tsx` 中 Geist sans 默认 `preload:true`；Geist_Mono 显式 `preload:false`）。`797e433ab948586e-s.p.1v5bejj26fx9h.woff2` 为旧部署同一机制。
2. CSS `1u6qx2h5ckes3.css` 的 `@font-face`（unicode-range `U+??` = U+0000-00FF，latin 子集）引用同一文件；`/` 首帧正文即含数字（总场次 16、X 胜 8、O 胜 4、平局 4、连胜 1）→ latin 字形首帧被用 → **字体并非真的未被用**。
3. `public/sw.js` 的 `CACHEABLE_RE` 匹配 `_next/static/` → 字体请求被 `event.respondWith()` 截走 → Chromium 的 preload 缓存条目无法被 SW 响应匹配/消耗 → 恒发 "preloaded but not used" 警告。字体显示正常，属 SW 截胡之噪音 + 白耗一次预载。

### 病乙 — sw.js:55 "Uncaught (in promise) TypeError: Failed to fetch" / "FetchEvent resulted in a network error response"
- `sw.js:55` = 不可缓存 GET（页面导航、RSC payload、/api）之直通路 `event.respondWith(fetch(event.request))`。
- 网络一断（ERR_CONNECTION_CLOSED / 离线），该 promise 在 SW 上下文被拒且无 catch → 未处理拒绝噪音。
- "Failed to fetch RSC payload … Falling back to browser navigation" 为 Next 客户端路由之正常回退，非病，不治。

## 二、目标与非目标

**目标**
1. 生产构建下 `/` 与 `/play` 加载后控制台无 "preloaded using link preload" 警告。
2. 网络失败时 SW 上下文无 Uncaught (in promise)；请求按浏览器原生网络错误处理。
3. 保持：PWA 可安装、manifest/icons SW 缓存层（P3 双层）、B-1 方法门控（非 GET 直通）、B-3 不缓存 RSC。

**非目标**
- 不引入 Workbox/Serwist；不加离线回退页；不改 manifest/icons 缓存策略；不改字体加载策略（除非预案 B 触发）；不 push。

## 三、变更清单

1. **sw.js Fix A**：`CACHEABLE_RE` 移除 `_next/static/`，只留 manifest/icons/favicon 族；`_next/static/**` 交还浏览器 HTTP immutable 缓存（Vercel 已发 immutable 头，原生 0ms），preload 得以被原生 font-face 请求消耗。同步改写头部注释。
2. **sw.js Fix B**：不可缓存 GET 直通路 `return;`（不再 `respondWith(fetch(...))`，无 SW 诺言即无未处理拒绝）；缓存 miss 之网络 fetch 包 try/catch → 返回 `Response.error()`（原生式网络错误）。
3. **新增 QA 探针** `tests/qa/sw-console-hygiene.mjs`（沿用 launchQA 约定，生产构建后才跑，禁 dev server）：
   - 硬断言 1：`/` 与 `/play` 控制台无 `/preloaded using link preload/`；
   - 硬断言 2：`caches.open('tic-tac-toe-v1')` keys 中 `_next/static/` 条目为 0；
   - 硬断言 3：`public/sw.js` 源码直通路无 `respondWith(fetch(`、miss 路径含 catch；
   - 尽力断言（软）：离线重载无 SW 未处理拒绝（若 Playwright 可捕 SW 控制台则断言，否则记日志跳过）。

**预案 B**（仅当 Fix A 后警告仍存）：`app/layout.tsx` 给 `Geist({...})` 加 `preload: false`，独立小提交，探针复跑。

## 四、验收标准（机器可判）

| # | 命令 | 判据 |
|---|---|---|
| AC1 | `node tests/qa/sw-console-hygiene.mjs` | exit 0 |
| AC2 | `pnpm vitest run && pnpm typecheck && pnpm lint && pnpm build` | 全 exit 0 |
| AC3 | `node tests/qa/commit-audit.mjs --branch main` | 0 violations |
| AC4 | git log -1 | Conventional + WHAT/WHY/HOW 正文 + lore trailer + `Plan: .omo/plans/ulw-font-preload-sw-fetch-20260914.md` 页脚；无 push |
| AC5 | fresh verifier 独立会话对抗复核 | 根因链、探针有效性、误伤面（B-1/B-3/PWA 安装）全数通过 |

## 五、执行序

1. fixer（fresh codex，herdr tab）：实施变更 1-3 → 跑 AC1-AC3 → 按提交契约 commit（禁 --no-verify、禁 push）。
2. verifier（fresh codex，只读 + 跑测试）：对抗复核 AC1-AC5；试图证伪探针与根因链。
3. 主会话汇总证据，回禀主公。
