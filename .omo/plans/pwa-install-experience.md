# pwa-install-experience - Work Plan

## TL;DR (For humans)
**What you'll get:** 一份 manifest.webmanifest + 一份 service worker + 一张 maskable 512 icon，让 Chrome / Android Chrome / Edge 在用户满足 install criteria 时弹"安装应用"提示，iOS Safari 在用户"添加到主屏"后启用 standalone 全屏模式。

**Why this approach:** Next.js 16 自带 `app/manifest.ts` 类型化 manifest route，无需手写 `public/manifest.json`；用 `app/manifest.ts` 同时拿到 `MetadataRoute.Manifest` 类型保护 + Next.js 自动注入 `<link rel="manifest">`。Service worker 是 Chrome PWA installability criteria 的硬性要求之一（manifest + HTTPS + service worker + ≥144px icon），本项目已有 180px apple-icon 和 512px PWA icon，仅缺 SW 这一块。Maskable icon 是 Android adaptive launcher 的最佳实践，safe zone = 80% 直径圆，所以把现有 180 logo 缩到 410 居中放在 512×512 #0b0f17 画布上即可。

**What it will NOT do:** 不引入新 npm 依赖（manifest + SW 都不需要）；不改任何 lib/db/components/routes；不加离线缓存（游戏无离线数据，缓存收益为零）；不加 push / background sync；不改 DESIGN.md / globals.css。

**Effort:** Quick
**Risk:** Low —— 4 个新文件（manifest.ts / sw.js / ServiceWorkerRegister.tsx / icon-maskable-512.png）+ 2 个改动（layout.tsx + build-favicon-assets.mjs），全部增量，零 npm 依赖，零路由改动，零设计契约变动。

**Decisions to sanity-check:**
- `theme_color` / `background_color` 用 `#0A0A0A`（不是 apple-icon 的 `#0b0f17`）—— 匹配 `app/layout.tsx:14` 的 `THEME_COLOR` 字面量 + `globals.css` 的 `--color-bg-base`，是浏览器 chrome / status bar 的正确颜色（apple-icon 背景色是图标专用）
- `display: "standalone"`（不是 `minimal-ui`）—— 完整 PWA 体验，无浏览器 UI
- SW 仅在 production 注册（dev 模式 SW 会破坏 Next.js fast refresh / HMR）

Your next move: approve the plan, then a worker session picks it up via `$start-work pwa-install-experience`.

---

> TL;DR (machine): Quick, Low. 1 份原子 commit `feat(pwa):` 落在 main。4 新文件 + 2 改动。零 npm 依赖。零路由/视觉/设计契约变动。改动 ⊆ {app/manifest.ts, public/sw.js, components/ServiceWorkerRegister.tsx, public/icon-maskable-512.png, app/layout.tsx, scripts/build-favicon-assets.mjs}。

## Scope
### Must have
- 新增 `app/manifest.ts`：Next.js 16 类型化 manifest route handler，default export 返回 `MetadataRoute.Manifest`
  - `name: "井字棋 · 同设备 pass-and-play"` / `short_name: "井字棋"` / `description: "两人同设备轮流下的井字棋，自动记录战绩。"`
  - `start_url: "/"` / `scope: "/"` / `display: "standalone"` / `orientation: "portrait"`
  - `theme_color: "#0A0A0A"` / `background_color: "#0A0A0A"`
  - `icons` 数组 9 项：`/favicon.ico` (48x48, image/x-icon) + `/icon.svg` (any, image/svg+xml) + `/favicon-16x16.png` / `/favicon-32x32.png` / `/favicon-48x48.png` (image/png) + `/icon-192.png` (any, image/png) + `/icon-512.png` (any, image/png) + `/icon-maskable-512.png` (512x512, image/png, `purpose: "maskable"`) + `/apple-icon` (180x180, image/png) + `/apple-touch-icon.png` (180x180, image/png)
- 新增 `public/sw.js`：~15 行 JS，包含 `install` / `activate` / `fetch` 三个 listener
  - `install` → `self.skipWaiting()`
  - `activate` → `event.waitUntil(self.clients.claim())`
  - `fetch` → `event.respondWith(fetch(event.request))`（network-first，零缓存）
- 新增 `components/ServiceWorkerRegister.tsx`：`'use client'` 组件
  - `useEffect` 注册 `/sw.js`，仅当 `process.env.NODE_ENV === "production"`
  - 注册失败 `console.warn` 但不抛错
- 新增 `public/icon-maskable-512.png`：512×512 PNG
  - 画布背景色 `#0b0f17`（与 apple-icon 内部色板一致，区别于 layout `#0A0A0A`）
  - 180×180 logo 居中缩到 410×410（80% 画布），所有视觉重心落在 safe zone 内
  - 由扩展后的 `scripts/build-favicon-assets.mjs` 派生，确定性输出
- 修改 `app/layout.tsx`：
  - `metadata` export 加 `manifest: "/manifest.webmanifest"` + `appleWebApp: { capable: true, title: "井字棋", statusBarStyle: "black" }`
  - body 在 `<Analytics />` 旁边加 `<ServiceWorkerRegister />`
- 修改 `scripts/build-favicon-assets.mjs`：
  - `TARGETS` 数组追加 `{ file: "public/icon-maskable-512.png", size: 512, maskable: true }`
  - maskable 走 ImageMagick 多步命令：源 180 → 缩 410 → gravity center 落到 512×512 #0b0f17 画布
  - 保持 `-define png:exclude-chunks=tIME,tEXt,zTXt,iTXt` 确定性
- 全部 6 个改动文件一起进 1 份原子 commit `feat(pwa): manifest + service worker + maskable icon 触发 PWA 安装体验`
- commit 带完整 lore trailers（Constraint / Rejected / Confidence / Scope-risk / Directive / Tested / Not-tested）+ `Plan: .omo/plans/pwa-install-experience.md` footer
- `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build` 全绿
- `node tests/qa/commit-audit.mjs --branch main` 0 violations

### Must NOT have (guardrails, anti-slop, scope boundaries)
- ❌ 新增 npm 依赖（manifest + SW 全部用 Next.js 内置 API + 浏览器原生 API）
- ❌ 修改 `lib/` / `db/` / `components/` 除新组件外的任何文件 / `app/api/` / `app/page.tsx` / `app/play/page.tsx` / `app/result/page.tsx` / `app/icon.svg` / `app/apple-icon.tsx` / `app/favicon.ico` / `app/globals.css` / `next.config.ts` / `tsconfig.json` / `eslint.config.mjs` / `vitest.config.ts` / `package.json` / `pnpm-lock.yaml`
- ❌ 修改 `AGENTS.md` / `DESIGN.md` / `CONTRIBUTING.md` / `docs/` / `README.md`
- ❌ 离线缓存策略（workbox / cache-first / stale-while-revalidate 等）—— 游戏无离线数据需求
- ❌ Push notifications / Background Sync / Periodic Background Sync
- ❌ `<meta name="mobile-web-app-capable">`（Chrome 弃用，manifest 替代）
- ❌ `<link rel="apple-touch-icon-precomposed">`（iOS 7+ 弃用）
- ❌ iOS Web App Splash startup images（项目视觉极简，启动画面即空白暗色底）
- ❌ 用 `git commit --no-verify` 绕过 commit-msg hook
- ❌ 在 executor turn 内执行 `vercel --prod` 或任何 Vercel CLI 自动化

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after + framework（vitest 不变；新增的 `app/manifest.ts` / `components/ServiceWorkerRegister.tsx` 不引入新单测，因为都是 declarative manifest + 5 行 useEffect；visual-qa 不变）
- Evidence: `.omx/evidence/pwa-install-experience/`
  - `task-{1..5}-pwa-install-experience-{typecheck,lint,vitest,build,commit-audit}.log`：每 todo 后跑对应命令
  - `pwa-curl/manifest.txt`：`curl -s http://localhost:3000/manifest.webmanifest` 完整 JSON dump
  - `pwa-curl/sw.txt`：`curl -s http://localhost:3000/sw.js` 完整 JS dump
  - `pwa-curl/maskable-png-meta.txt`：`identify public/icon-maskable-512.png` 输出（验证 512×512）
  - `pwa-curl/html-head.html`：`curl -s http://localhost:3000/ | grep -oE '<(link|meta)[^>]*>' | sort -u` 验证新增 `<link rel="manifest">` + `<meta name="apple-mobile-web-app-*">`
  - `pwa-curl/determinism.txt`：build-favicon-assets.mjs 三次连续运行（含 sleep 3s）的 MD5 输出，证明 maskable 也确定性
- MOMUS / 高精度复审：用户没要求，按 ulw-plan `intent: clear, review_required: false` 跳过
- 自查（每 todo 都跑）：
  - `app/manifest.ts` 跑一次 `node -e "console.log(JSON.stringify(require('./.next/types/...'))"` 确认 TS 类型推断 OK
  - `public/sw.js` 跑一次 `node -c public/sw.js` 确认语法 OK（虽然浏览器执行，但语法可静态校验）
  - `components/ServiceWorkerRegister.tsx` 跑一次 `pnpm typecheck`（client component 必走 TS 检查）
- 端到端 PWA 验证：部署到 Vercel 后人工验证「Install」提示出现（不在 agent 射程内，留为 success criteria 第 6 项）

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.

本 plan 5 个 todo 是 5 个独立文件 + 1 个修改，全部互不冲突（不同文件），可以并行写，最后一次性 commit。waves 分布：
- **Wave 1（5 个 todo 并行）**：
  - todo 1：扩展 build-favicon-assets.mjs（脚本改动，可与 todo 2/3/4/5 并行）
  - todo 2：新增 app/manifest.ts（manifest route，可与 todo 1/3/4/5 并行）
  - todo 3：新增 public/sw.js（service worker，可与 todo 1/2/4/5 并行）
  - todo 4：新增 components/ServiceWorkerRegister.tsx（client component，可与 todo 1/2/3/5 并行）
  - todo 5：修改 app/layout.tsx（layout 改动，可与 todo 1/2/3/4 并行；但语义上依赖 todo 2 和 todo 4 已完成才能正确引用 `<ServiceWorkerRegister />`，故串行）
- **Wave 2（1 个 commit + 1 个验证 todo）**：
  - todo 6：原子 commit + 跑全套 gauntlet + 写 PWA 特定 curl 证据
- **Final verification wave（F1/F2/F3/F4 并行）**

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1. build-favicon-assets.mjs 扩展 | 无 | 6 | 2, 3, 4 |
| 2. app/manifest.ts 新增 | 无 | 5 (metadata 字段), 6 | 1, 3, 4 |
| 3. public/sw.js 新增 | 无 | 4 (sw 注册引用), 6 | 1, 2 |
| 4. components/ServiceWorkerRegister.tsx 新增 | 3 | 5 (layout import), 6 | 1, 2 |
| 5. app/layout.tsx 修改 | 2, 4 | 6 | 串行于 2, 4 |
| 6. atomic commit + 验证套件 | 1, 2, 3, 4, 5 | F1, F2, F3, F4 | 串行于所有 |
| F1. Plan compliance | 6 | （最终汇报） | F2, F3, F4 |
| F2. Code quality | 6 | （最终汇报） | F1, F3, F4 |
| F3. Real manual QA | 6 | （最终汇报） | F1, F2, F4 |
| F4. Scope fidelity | 6 | （最终汇报） | F1, F2, F3 |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->

### Wave 1: 5 个并行文件操作

- [ ] 1. feat(scripts): build-favicon-assets.mjs 扩展生成 maskable icon
  What to do / Must NOT do: 在 `scripts/build-favicon-assets.mjs` 的 `TARGETS` 数组追加 `{ file: "public/icon-maskable-512.png", size: 512, maskable: true }`；把单步 `magick` 调用改成条件分支：非 maskable 走原路径（保留 `-define png:exclude-chunks=tIME,tEXt,zTXt,iTXt`），maskable 走两步（先 `magick source -filter Lanczos -resize 410x410 -define png:exclude-chunks=tIME,tEXt,zTXt,iTXt /tmp/m-410.png`，再 `magick -size 512x512 canvas:#0b0f17 /tmp/m-bg.png && magick /tmp/m-bg.png /tmp/m-410.png -gravity center -composite -define png:exclude-chunks=tIME,tEXt,zTXt,iTXt public/icon-maskable-512.png`）。**禁止**改其它非 maskable 路径的逻辑；**禁止**改 `DEFAULT_SOURCE` / `SIZES` 之外的既有逻辑；**禁止**添加新 npm 依赖；**禁止**用 sharp / node-canvas 等替代 ImageMagick；**禁止**把 `#0b0f17` 写死到非 maskable 路径。**禁止**用 `git commit --no-verify`。
  Parallelization: Wave 1 | Blocked by: 无 | Blocks: 6
  References (executor has NO interview context - be exhaustive):
  - `scripts/build-favicon-assets.mjs:1-105`（既有结构）
  - `scripts/build-favicon-assets.mjs:43-58`（TARGETS 数组）
  - `scripts/build-favicon-assets.mjs:78-99`（magick 调用循环）
  - `app/apple-icon.tsx:5-9`（ICON_COLORS.background = "#0b0f17" 是 maskable 底色来源）
  - `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md:1-50`（Next.js 16 manifest convention）
  - https://web.dev/articles/maskable-icon/（maskable safe zone = 80% 直径圆）
  Acceptance criteria (agent-executable):
  - `pnpm typecheck` exit 0（脚本不参与 typecheck，但保险起见跑一次）
  - `pnpm lint` exit 0
  - `node scripts/build-favicon-assets.mjs` 退出码 0 + stdout 含 `public/icon-maskable-512.png (512x512)`
  - `identify public/icon-maskable-512.png` 输出 `PNG 512x512 512x512+0+0 8-bit sRGB ...`
  - `md5 public/icon-maskable-512.png` 在 3 次连续运行（含 sleep 3s）下保持不变
  - `identify -verbose public/icon-maskable-512.png` 输出不含 `tIME` chunk 且不含 `tEXt:date:*` / `tEXt:Software` 等时间戳元数据
  QA scenarios (name the exact tool + invocation):
  - happy: `pnpm build && node scripts/build-favicon-assets.mjs && identify public/icon-maskable-512.png` → 期望 `PNG 512x512`，evidence `.omx/evidence/pwa-install-experience/task-1-maskable-identify.log`
  - happy (determinism): `for i in 1 2 3; do node scripts/build-favicon-assets.mjs > /dev/null; sleep 3; md5 -q public/icon-maskable-512.png; done` → 期望 3 行 MD5 完全一致，evidence `.omx/evidence/pwa-install-experience/task-1-determinism.log`
  - failure (wrong source): 不可能脚本本身写错路径（CLI parse 已处理 missing source），但若 `DEFAULT_SOURCE` 不存在应 exit 1 + 友好错误信息（既有逻辑，已验证）
  - failure (overwrite): 在 `public/icon-maskable-512.png` 锁定只读（chmod 444）后跑脚本，期望 exit 非 0 不破坏既有字节（实际上既有脚本逻辑是 execFileSync 写入，权限不足会 throw）
  Evidence: `.omx/evidence/pwa-install-experience/task-1-{identify,determinism,typecheck,lint}.log`
  Commit: N（与 todo 2/3/4/5 一起进 todo 6 的原子 commit）

- [ ] 2. feat(manifest): 新增 app/manifest.ts 类型化 manifest route
  What to do / Must NOT do: 新增 `app/manifest.ts`（约 30 行 TypeScript），default export 一个 `manifest()` 函数返回 `MetadataRoute.Manifest` 对象。manifest 字段：name / short_name / description（与 `app/layout.tsx:21-24` 的 metadata 保持一致）/ start_url: "/" / scope: "/" / display: "standalone" / orientation: "portrait" / theme_color: "#0A0A0A" / background_color: "#0A0A0A"。icons 数组 9 项（见 Must have 第 1 条）。**禁止**手写 `public/manifest.json`（用 app/manifest.ts 走 Next.js 路由约定）；**禁止**改其它任何文件；**禁止**引入新依赖。**禁止**把 theme_color 改成 `#0b0f17`（那是 apple-icon 专用，会与 layout.themeColor 冲突）。**禁止**用 `git commit --no-verify`。
  Parallelization: Wave 1 | Blocked by: 无 | Blocks: 5 (layout 引用), 6
  References (executor has NO interview context - be exhaustive):
  - `app/layout.tsx:21-30`（既有 metadata：title / description，manifest.name / short_name / description 必须从这里 mirror）
  - `app/layout.tsx:14`（THEME_COLOR = "#0A0A0A" 字面量，manifest.theme_color / background_color 必须 mirror）
  - `app/globals.css:11`（`--color-bg-base: #0A0A0A`，与 THEME_COLOR 互为冗余，manifest 同源）
  - `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md:1-50`（Next.js 16 manifest convention）
  - `node_modules/next/dist/lib/metadata/types/metadata-interface.d.ts:247-249`（manifest 字段类型 string | URL）
  - `node_modules/next/dist/lib/metadata/types/manifest-types.d.ts:1-N`（MetadataRoute.Manifest 类型定义）
  - https://developer.mozilla.org/docs/Web/Manifest（Web App Manifest spec）
  Acceptance criteria (agent-executable):
  - `pnpm typecheck` exit 0（app/manifest.ts 必走 TS 检查）
  - `pnpm lint` exit 0
  - `pnpm build` exit 0 + build 输出含 `/manifest.webmanifest` 路由
  - `pnpm start &` 后 `curl -s http://localhost:3000/manifest.webmanifest` 返回合法 JSON，含 `name` / `short_name` / `start_url: "/"` / `display: "standalone"` / `theme_color: "#0A0A0A"` / `icons` 数组长度 === 9
  - `curl -s http://localhost:3000/ | grep -o '<link rel="manifest"[^>]*>'` 应返回一行
  QA scenarios (name the exact tool + invocation):
  - happy: `pnpm build 2>&1 | grep manifest.webmanifest` → 期望 1 行命中，evidence `.omx/evidence/pwa-install-experience/task-2-build.log`
  - happy: `pnpm start & sleep 5 && curl -sf http://localhost:3000/manifest.webmanifest | jq '.name, .short_name, .display, .theme_color, (.icons | length)'` → 期望 5 行输出，evidence `.omx/evidence/pwa-install-experience/task-2-curl-manifest.txt`
  - happy: `curl -s http://localhost:3000/ | grep -oE '<(link|meta)[^>]*>' | grep -iE 'manifest|apple-mobile-web-app' | sort -u` → 期望含 `<link rel="manifest" href="/manifest.webmanifest?...">`，evidence `.omx/evidence/pwa-install-experience/task-2-html-head.html`
  - failure (invalid JSON): 不应发生，但若 manifest.ts 语法错 TS 编译会拦；若字段值类型错（如 theme_color 传对象）typecheck 会拦
  Evidence: `.omx/evidence/pwa-install-experience/task-2-{typecheck,lint,build,curl-manifest,html-head}.log`
  Commit: N（与 todo 1/3/4/5 一起进 todo 6 的原子 commit）

- [ ] 3. feat(sw): 新增 public/sw.js 最小 service worker
  What to do / Must NOT do: 新增 `public/sw.js`（~15 行原生 JS，无 TypeScript，无依赖）。内容：3 个 `self.addEventListener` 监听 `install` / `activate` / `fetch`，fetch handler 走 `fetch(event.request)`（network-first，零缓存）。**禁止**写任何缓存策略（cacheStorage / caches.open / caches.match）；**禁止**用 Workbox / sw-toolbox / sw-precache 等第三方；**禁止**写 importScripts 加载额外脚本；**禁止**改其它任何文件。**禁止**用 `git commit --no-verify`。
  Parallelization: Wave 1 | Blocked by: 无 | Blocks: 4 (sw 注册组件引用), 6
  References (executor has NO interview context - be exhaustive):
  - https://developer.chrome.com/docs/devtools/progressive-web-apps/（PWA installability criteria：HTTPS + manifest + service worker with fetch handler + ≥144px icon）
  - https://developer.mozilla.org/docs/Web/API/Service_Worker_API（ServiceWorker API 文档）
  - https://web.dev/learn/pwa/service-workers（service worker 生命周期 + fetch event 必要性）
  Acceptance criteria (agent-executable):
  - `node -c public/sw.js` 退出码 0（语法校验，Node 解析 sw.js 作为模块）
  - `pnpm build` exit 0（public/ 静态文件透传，无特殊处理）
  - `pnpm start & sleep 5` 后 `curl -sf http://localhost:3000/sw.js` 返回 200 + content-type `application/javascript` + body 含 `addEventListener('install'` 和 `addEventListener('fetch'`
  - `curl -sf http://localhost:3000/sw.js | grep -c "addEventListener"` 应 >= 3（install / activate / fetch）
  - sw.js 不被 Next.js 当路由（curl /sw.js 不应触发 SSR / RSC fallback，应是静态文件）
  QA scenarios (name the exact tool + invocation):
  - happy: `node -c public/sw.js && echo SYNTAX_OK` → 期望 SYNTAX_OK，evidence `.omx/evidence/pwa-install-experience/task-3-syntax.log`
  - happy: `pnpm start & sleep 5 && curl -sI http://localhost:3000/sw.js | head -5` → 期望 `HTTP/1.1 200 OK` + `Content-Type: application/javascript`，evidence `.omx/evidence/pwa-install-experience/task-3-curl-headers.log`
  - happy: `curl -s http://localhost:3000/sw.js` body dump，evidence `.omx/evidence/pwa-install-experience/task-3-curl-body.log`
  - failure (no fetch handler): 故意移除 fetch listener 后跑 chrome devtools lighthouse PWA audit，期望 fail。但 agent 范围内不强制跑 lighthouse，留为人工 spot check
  Evidence: `.omx/evidence/pwa-install-experience/task-3-{syntax,curl-headers,curl-body,build}.log`
  Commit: N（与 todo 1/2/4/5 一起进 todo 6 的原子 commit）

- [ ] 4. feat(client): 新增 components/ServiceWorkerRegister.tsx SW 注册组件
  What to do / Must NOT do: 新增 `components/ServiceWorkerRegister.tsx`（~10 行 React client component）。内容：`'use client'` 指令；default export 一个无 props 函数组件；在 `useEffect` 内（依赖数组 `[]`）调用 `navigator.serviceWorker.register('/sw.js').catch(console.warn)`，外层 `if (process.env.NODE_ENV === "production")` 守卫。**禁止**添加 props；**禁止**在 dev 模式注册（会破坏 HMR / fast refresh）；**禁止**加 setTimeout / setInterval / onerror UI 提示；**禁止**用 next/script 替代（脚本已是显式 client component 写法）。**禁止**改其它任何 components/ 文件。**禁止**用 `git commit --no-verify`。
  Parallelization: Wave 1 | Blocked by: 3 (引用 /sw.js) | Blocks: 5 (layout import), 6
  References (executor has NO interview context - be exhaustive):
  - `components/SoundToggle.tsx:1-30`（既有 'use client' 组件写法，参考样板）
  - `app/layout.tsx:36-44`（既有 `<Analytics />` 渲染位置，新组件放它旁边）
  - https://developer.mozilla.org/docs/Web/API/ServiceWorkerContainer/register（serviceWorker.register API）
  - https://nextjs.org/docs/app/api-reference/directives/use-client（'use client' 约定）
  Acceptance criteria (agent-executable):
  - `pnpm typecheck` exit 0（client component 必走 TS 检查）
  - `pnpm lint` exit 0
  - `pnpm vitest run` exit 0 + 88/88（新增组件不引入新测试）
  - `pnpm build` exit 0
  - `pnpm start & sleep 5` 后 `curl -s http://localhost:3000/ | grep -c "ServiceWorkerRegister\\|sw-register"` 不应有 SSR 渲染证据（client component 不 SSR）
  - 在 production 模式下用 chrome devtools 看 `navigator.serviceWorker.controller` 应非 null（需真浏览器，留为人工 spot check）
  QA scenarios (name the exact tool + invocation):
  - happy: `pnpm typecheck && pnpm lint && pnpm vitest run` → 期望全部 exit 0，evidence `.omx/evidence/pwa-install-experience/task-4-{typecheck,lint,vitest}.log`
  - happy: `pnpm build 2>&1 | grep -E "Compiling|Generating" | head -10` → 期望含 client component 编译信息，evidence `.omx/evidence/pwa-install-experience/task-4-build.log`
  - failure (no use client): 若遗漏 `'use client'` 指令，`useEffect` 会 SSR 抛 `ReferenceError: useEffect is not defined`，typecheck 不一定拦住但运行时必挂。手动 grep `'use client'` 必须命中文件首行
  Evidence: `.omx/evidence/pwa-install-experience/task-4-{typecheck,lint,vitest,build,grep-use-client}.log`
  Commit: N（与 todo 1/2/3/5 一起进 todo 6 的原子 commit）

- [ ] 5. feat(layout): app/layout.tsx 加 metadata + ServiceWorkerRegister
  What to do / Must NOT do: 修改 `app/layout.tsx`：在 `export const metadata: Metadata = { ... }` 对象中追加 `manifest: "/manifest.webmanifest"` 和 `appleWebApp: { capable: true, title: "井字棋", statusBarStyle: "black" }` 字段；在 `export default function RootLayout({...})` 的 body JSX 里，紧邻 `<Analytics />` 添加 `<ServiceWorkerRegister />`（import 在文件顶）。**禁止**改 viewport export（已含 themeColor / colorScheme，重复添加会冲突）；**禁止**改 metadata 的 title / description / metadataBase（已有正确值）；**禁止**改 `<html>` / `<body>` className（已有 `h-full antialiased` + `bg-bg-base text-text-primary`）；**禁止**改 Analytics 组件本身。**禁止**用 `git commit --no-verify`。
  Parallelization: Wave 1 | Blocked by: 2 (引用 manifest URL), 4 (引用 ServiceWorkerRegister 组件) | Blocks: 6
  References (executor has NO interview context - be exhaustive):
  - `app/layout.tsx:1-50`（既有完整 layout 文件）
  - `app/layout.tsx:21-30`（既有 metadata export 字段）
  - `app/layout.tsx:36-44`（既有 body JSX + Analytics）
  - `node_modules/next/dist/lib/metadata/types/extra-types.d.ts:55-60`（AppleWebApp 类型定义）
  - `node_modules/next/dist/lib/metadata/types/metadata-interface.d.ts:247-249`（Metadata.manifest 字段类型）
  - `node_modules/next/dist/lib/metadata/types/metadata-interface.d.ts:336-341`（Metadata.appleWebApp 字段类型）
  Acceptance criteria (agent-executable):
  - `pnpm typecheck` exit 0（新增 metadata 字段必走 TS 类型检查）
  - `pnpm lint` exit 0
  - `pnpm build` exit 0 + build output 含 `apple-mobile-web-app-capable` 等新 meta tags
  - `pnpm start & sleep 5` 后 `curl -s http://localhost:3000/ | grep -oE '<(link|meta)[^>]*>' | grep -iE 'manifest|apple-mobile-web-app' | sort -u` 应返回 ≥ 4 行（link manifest + meta capable + meta title + meta status-bar-style）
  - `git diff HEAD~1..HEAD -- app/layout.tsx | grep -c '^+'` ≤ 10（净增 ≤ 10 行：2 个 metadata 字段 + 1 个 import + 1 个 JSX 行 + Plan/lore 注释行）
  QA scenarios (name the exact tool + invocation):
  - happy: `pnpm typecheck && pnpm lint && pnpm build` → 期望全部 exit 0，evidence `.omx/evidence/pwa-install-experience/task-5-{typecheck,lint,build}.log`
  - happy: `pnpm start & sleep 5 && curl -s http://localhost:3000/ | grep -oE '<(link|meta)[^>]*>' | sort -u` → 期望含新 link/meta，evidence `.omx/evidence/pwa-install-experience/task-5-html-head.html`
  - happy: `git diff HEAD~1..HEAD --stat -- app/layout.tsx` → 期望 1 file changed，net lines ≤ 10，evidence `.omx/evidence/pwa-install-experience/task-5-diff-stat.log`
  - failure (duplicate themeColor): 若同时在 metadata 和 viewport 都加 themeColor，Next.js 会报 warning 或冲突，typecheck 不一定拦但 build 会暴露
  Evidence: `.omx/evidence/pwa-install-experience/task-5-{typecheck,lint,build,html-head,diff-stat}.log`
  Commit: N（与 todo 1/2/3/4 一起进 todo 6 的原子 commit）

### Wave 2: 原子 commit + 完整 gauntlet

- [ ] 6. feat(pwa): 提交 manifest + service worker + maskable icon + layout 集成
  What to do / Must NOT do: 把 todo 1-5 的全部改动（scripts/build-favicon-assets.mjs / app/manifest.ts / public/sw.js / components/ServiceWorkerRegister.tsx / public/icon-maskable-512.png / app/layout.tsx）一次性 `git add` + `git commit` 为单份原子 commit `feat(pwa): manifest + service worker + maskable icon 触发 PWA 安装体验`。commit body 写 WHAT/WHY/HOW 3 段；lore trailers 含 Constraint / Rejected / Confidence / Scope-risk / Directive / Tested / Not-tested + `Plan: .omo/plans/pwa-install-experience.md` footer。commit message 必须先 `node tests/qa/commit-audit.mjs --message-file <tmp>` 校验 PASS 再正式 commit。**禁止**拆 commit（5 个改动必须合一，因为 service worker 单独存在而 manifest 没引用 = 不完整，反之亦然）；**禁止**用 `git commit --no-verify`；**禁止**改 commit 历史（amend 已发布 commit）；**禁止**commit 未在 todo 1-5 中显式列出的文件（dirty worktree 一律不进 commit）。
  Parallelization: Wave 2 | Blocked by: 1, 2, 3, 4, 5 | Blocks: F1, F2, F3, F4
  References (executor has NO interview context - be exhaustive):
  - `tests/qa/commit-audit.mjs:110-160`（commit message 校验规则：R1-R5）
  - `tests/qa/commit-audit.mjs:21-22`（TYPE_RE / PROMPT_RE 主题前缀正则）
  - `tests/qa/commit-audit.mjs:130-140`（isPrompt 跳过 lore 检查的逻辑）
  - `tests/qa/commit-audit.mjs:144-152`（Confidence / Scope-risk / Plan 必填校验）
  - `.git/hooks/commit-msg`（commit-msg hook 调用 commit-audit.mjs）
  - `.omo/plans/result-rsc-mobile-favicon-font-warnings.md`（既有 plan 风格参考）
  - `docs/verification-gauntlet.md`（6 层 gauntlet 文档，On-demand 规则）
  Acceptance criteria (agent-executable):
  - `node tests/qa/commit-audit.mjs --message-file <tmp>` PASS（commit 前预校验）
  - `git add scripts/build-favicon-assets.mjs app/manifest.ts public/sw.js components/ServiceWorkerRegister.tsx public/icon-maskable-512.png app/layout.tsx` 成功（无未跟踪意外文件）
  - `git status -s` 显示 6 个 A 文件 + 0 未跟踪意外 + 0 modified
  - `git commit -F <tmp>` 成功 + commit-audit hook 输出 PASS
  - `git log -1 --format=%s` 匹配 `^feat\(.*\): .+`
  - `git log -1 --pretty=%b` 含 WHAT/WHY/HOW + 全部 lore trailers + `Plan: .omo/plans/pwa-install-experience.md` footer
  - `node tests/qa/commit-audit.mjs --branch main` 输出 `branch=main total=N+1 pass=N+1 fail=0`（N 是 HEAD~1 时的 total）
  - `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build && node tests/qa/commit-audit.mjs --branch main` 全部 exit 0
  - `pnpm start & sleep 5` 后 PWA 特定 curl 验证（manifest / sw.js / maskable PNG / HTML head link+meta）全部 PASS
  QA scenarios (name the exact tool + invocation):
  - happy: 完整 6 层 gauntlet 一遍过，evidence `.omx/evidence/pwa-install-experience/task-6-gauntlet.log`
  - happy (commit-audit branch): `node tests/qa/commit-audit.mjs --branch main` → 期望 0 fail，evidence `.omx/evidence/pwa-install-experience/task-6-commit-audit.log`
  - happy (PWA curl bundle): `pnpm start & sleep 5 && { curl -sf http://localhost:3000/manifest.webmanifest | jq .; curl -sI http://localhost:3000/sw.js | head -3; identify public/icon-maskable-512.png; curl -s http://localhost:3000/ | grep -oE '<(link|meta)[^>]*>' | grep -iE 'manifest|apple-mobile'; } | tee .omx/evidence/pwa-install-experience/task-6-pwa-curl-bundle.log`，期望 4 段输出全 PASS
  - failure (commit-audit fail): 若 lore 漏 Confidence / Scope-risk / Plan，commit-msg hook 会拒 commit；agent 必须看 hook 输出补全再 retry
  - failure (no plan footer): commit-msg hook R5 拒绝；agent 必须按 schema 补 Plan: 行
  Evidence: `.omx/evidence/pwa-install-experience/task-6-{commit-audit,gauntlet,pwa-curl-bundle}.log`
  Commit: Y | `feat(pwa): manifest + service worker + maskable icon 触发 PWA 安装体验`

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit
- [ ] F2. Code quality review
- [ ] F3. Real manual QA
- [ ] F4. Scope fidelity

### F1 具体口径
- 6 层 inline gauntlet（typecheck/lint/vitest 88/build/commit-audit 0 violations）全部 exit 0
- plan 文件存在：`.omo/plans/pwa-install-experience.md` 与执行结果一致
- 末尾证据：`.omx/evidence/pwa-install-experience/` 含 task-{1..6}-*.log + pwa-curl/* 全部输出

### F2 具体口径
- `git diff HEAD~1..HEAD --stat` 总 LOC ≤ 150（5 个新文件 + 1 个 layout 修改的净增）
- 改动文件集合 ⊆ {app/manifest.ts, public/sw.js, components/ServiceWorkerRegister.tsx, public/icon-maskable-512.png, app/layout.tsx, scripts/build-favicon-assets.mjs} 严格 6 文件
- app/layout.tsx 净增 ≤ 10 行（仅 metadata 字段 + import + JSX）
- 6 份 commit 顺序保证 todo 1-5 → todo 6 单原子
- 无新增 ESLint disable / `@ts-ignore` / `as any` / `console.log`（允许 ServiceWorkerRegister.tsx 内的 `console.warn`，因为这是 SW 注册失败的合理警告）
- `app/manifest.ts` 用类型化 MetadataRoute.Manifest（不写 `as any` / 不写 untyped JSON 字面量）

### F3 具体口径
- `pnpm start &` 后 `curl -sf http://localhost:3000/manifest.webmanifest | jq` 输出合法 JSON 且所有字段类型正确
- `curl -sI http://localhost:3000/sw.js` 返回 200 + content-type `application/javascript`
- `curl -s http://localhost:3000/` HTML head 含 `<link rel="manifest" href="/manifest.webmanifest?...">` + `<meta name="apple-mobile-web-app-capable" content="yes">` + `<meta name="apple-mobile-web-app-title" content="井字棋">` + `<meta name="apple-mobile-web-app-status-bar-style" content="black">` 共 ≥ 4 项
- `identify public/icon-maskable-512.png` 输出 `PNG 512x512`
- build-favicon-assets.mjs 3 次连续运行（含 sleep 3s）MD5 完全一致
- （部署到 Vercel 后人工验证）Chrome / Edge / Android Chrome 桌面访问 `https://3t-tic-tac-toe.vercel.app/` 满足停留 ≥ 30s 后，地址栏右侧出现"安装"图标 → 点击触发 install prompt → 安装后 standalone 窗口打开游戏
- （部署到 Vercel 后人工验证）iOS Safari 访问 → 分享菜单 → "添加到主屏" → 主屏图标显示井字棋 → 从主屏打开是 standalone 全屏（无 Safari UI）

### F4 具体口径
- 改动文件集合 ⊆ {app/manifest.ts, public/sw.js, components/ServiceWorkerRegister.tsx, public/icon-maskable-512.png, app/layout.tsx, scripts/build-favicon-assets.mjs} 严格 6 文件
- 0 lines changed in `lib/` / `db/` / `app/api/` / `app/page.tsx` / `app/play/page.tsx` / `app/result/page.tsx` / `app/icon.svg` / `app/apple-icon.tsx` / `app/favicon.ico` / `app/globals.css` / `next.config.ts` / `tsconfig.json` / `eslint.config.mjs` / `vitest.config.ts` / `stryker.config.mjs` / `commitlint.config.cjs` / `package.json` / `pnpm-lock.yaml`
- 0 lines changed in `AGENTS.md` / `DESIGN.md` / `CONTRIBUTING.md` / `docs/` / `README.md`
- 0 changes to既有 components/ 文件（除新增 ServiceWorkerRegister.tsx）
- 反模式审计：`grep -rn 'use client' components/ServiceWorkerRegister.tsx` 必须命中首行；`grep -rn 'console.log' app/manifest.ts public/sw.js` 必须 0 命中；`grep -rn 'as any\\|@ts-ignore' app/manifest.ts components/ServiceWorkerRegister.tsx` 必须 0 命中
- 视觉契约：manifest.theme_color = `#0A0A0A` 与 `app/globals.css:11` 的 `--color-bg-base` 一致；icon-maskable-512.png 底色 `#0b0f17` 与 `app/apple-icon.tsx:8` 的 `ICON_COLORS.background` 一致（这两个是不同的颜色，但都有合理源头）
- 范围忠实性：未触碰除上述 6 文件外的任何文件；新文件存在 4 个；layout 唯一改动是 metadata 加 2 字段 + body 加 1 JSX 行 + 1 import 行

## Commit strategy
- **1 份原子 commit 落在 main**：`feat(pwa): manifest + service worker + maskable icon 触发 PWA 安装体验`
  - 唯一改动：6 文件（5 新 + 1 改）
  - `git diff HEAD~1..HEAD --stat` 总 LOC ≤ 150，净增行数 ≤ 120
- commit 必须独立 `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build` 全绿
- commit 必带完整 lore trailers（Constraint / Rejected / Confidence / Scope-risk / Directive / Tested / Not-tested）+ `Plan: .omo/plans/pwa-install-experience.md` footer
- `Not-tested:` 必显式声明 3 类 on-demand 跳过：
  - Coverage: scope = `lib/**` + `db/**`，本次改动全在 `app/` + `components/` + `public/` + `scripts/`，跳过
  - Mutation: scope = `lib/game.ts` + `lib/db.ts` + `lib/store.ts` + `db/schema.ts`，本次不触及这 4 个文件，跳过
  - Property-based: scope = `lib/**/*.property.test.ts`，本次未新增纯函数文件，跳过
- commit 的 lore `Directive:` 段写明：
  - 「PWA installability criteria 需要 HTTPS（Vercel 提供）+ manifest + service worker with fetch handler + ≥144px icon，本 commit 一次性补齐后两块，Chrome / Edge / Android Chrome 满足 ≥30s 停留后会弹 install prompt」
  - 「iOS Safari 不支持 manifest 触发的 install prompt，但 standalone 模式通过 `apple-mobile-web-app-capable: yes` 启用；用户需走系统分享菜单的"添加到主屏"路径」
  - 「Service worker 仅在 production 注册（dev 模式 SW 会破坏 Next.js fast refresh / HMR，未来若加 workbox 或 cache-first 策略要重新评估）」
- commit-msg 钩子由 `node tests/qa/commit-audit.mjs --message-file <tmp>` 兜底校验；不允许 `--no-verify`
- 不动 `main` 之外的分支；不动既有 plan 的 footer

## Success criteria
- 浏览器访问 `https://3t-tic-tac-toe.vercel.app/` 后 `<head>` 含 `<link rel="manifest" href="/manifest.webmanifest?<hash>">` + `<meta name="apple-mobile-web-app-capable" content="yes">` + `<meta name="apple-mobile-web-app-title" content="井字棋">` + `<meta name="apple-mobile-web-app-status-bar-style" content="black">` 共 ≥ 4 项新 tag
- `curl -s https://3t-tic-tac-toe.vercel.app/manifest.webmanifest` 返回合法 JSON，含 `name` / `short_name` / `start_url: "/"` / `display: "standalone"` / `theme_color: "#0A0A0A"` / `icons` 数组长度 === 9
- `curl -sI https://3t-tic-tac-toe.vercel.app/sw.js` 返回 200 + `Content-Type: application/javascript`
- `curl -sI https://3t-tic-tac-toe.vercel.app/icon-maskable-512.png` 返回 200 + `Content-Type: image/png`
- `pnpm build` warning 列表与 baseline 相比**未扩大**
- Chrome 桌面访问满足 ≥30s 停留后，地址栏出现"安装"图标（deploy 后人工验证）
- iOS Safari 走"添加到主屏"后，主屏图标显示井字棋，从主屏打开是 standalone 全屏（deploy 后人工验证）
- `tests/qa/visual-qa.mjs` 跑完后 qa-log.json 的 5 个 stage 全部不受影响（visual-qa 没断言 manifest/SW，但也不能因新 JS 而 fail；snapshots 期望不变）
- `node tests/qa/commit-audit.mjs --branch main` 0 violations
- `git log main -1 --format=%s` 主题前缀 `feat(pwa):`，每个 `git log -1 --pretty=%b` 含完整 lore + Plan: footer
- 0 新增 npm 依赖
- 改动文件 ⊆ {app/manifest.ts, public/sw.js, components/ServiceWorkerRegister.tsx, public/icon-maskable-512.png, app/layout.tsx, scripts/build-favicon-assets.mjs} = 6 个文件
- 无 ESLint disable / 无 `@ts-ignore` / 无 `as any`（允许 `console.warn`）
- 高精度复审：plan 已 `intent: clear, review_required: false`，按 ulw-plan 规则跳过 momus / independent dual review
