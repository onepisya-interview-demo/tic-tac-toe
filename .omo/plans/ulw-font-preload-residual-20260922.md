# ulw: 字体 preload 偶发警告残留——调研结论与拆除计划（2026-09-22）

- 日期: 2026-09-22
- 状态: proposed（待主公批准执行）
- 分支: dev
- 来源: 主公报告「上轮修复（fa76a39 + 95c57e1）后，线上仍**偶发** woff 字体 preload 警告」
- 前序: `.omo/plans/ulw-font-preload-sw-fetch-20260914.md`（上轮 Fix A/B + 预案 B 条款）

## 一、现状防线盘点（上轮已落三道，均已在线上 main 生效）

| 防线 | 提交 | 内容 | 现场核验 |
| --- | --- | --- | --- |
| Geist Mono 关 preload | 95c57e1 | `app/layout.tsx` `Geist_Mono({ preload: false })` | 在档，Link 头仅剩 sans 一条 |
| SW 撤出 `/_next/static/**` | fa76a39 | `CACHEABLE_RE` 只留 manifest/icon/favicon 族，fetch handler 白名单外直接 `return` | 在档，探针 step03/05 守护 |
| URL/crossorigin 匹配 | next/font 生成 | Link 头 preload URL 与 CSS `@font-face` src 逐字一致（线上 curl 实证 `caa3a2e1…-s.p.0zr6hhvz-h9nw.woff2` 两处同串），`crossorigin=""` 与字体请求 anonymous mode 匹配 | 无恙 |

三道防线之下主公现场仍偶发 → 偶发源不在这三道防线覆盖的层面。

## 二、本轮调研证据链（2026-09-22 实测）

### 2.1 preload 形态已迁移：`Link:` 响应头（Early Hints），不在 HTML

线上 curl 实证（3t-tic-tac-toe.vercel.app）：
- `/` 与 `/result?room=` 响应头带 `Link: </_next/static/immutable/media/caa3a2e1…-s.p.*.woff2>; rel=preload; as="font"; crossorigin=""`；
- HTML `<head>` 内**无**任何 `as="font"` 的 `<link rel=preload>`（仅 `as="script"` 一条）。

Next 16 + Vercel 的 Early Hints 形态。含义：preload 条目由 edge 在 HTML 到达前注册，匹配消费链路多了 CDN/EH 一层，页面源码完全不可见——上轮探针 step05 读 `document.querySelector('link[rel=preload][as=font]')` 在此形态下恒 null（走 fallback 硬编码 hash），探针与线上机制已脱节。

### 2.2 机制级定位：Chromium「304 Not Modified preload 误报」bug

- Chromium Gerrit **CL 8280884**「Suppress unused preload warning on 304 Not Modified in ResourceFetcher::MatchPreload」（2025-08 提交，**Bug 517439604**）：
  - preload 资源收到 **304（无 body）** 时不能直接复用，后续请求（如 CSS 字体加载）从 HTTP disk cache 另取新 Resource；
  - 旧版 Chromium 的 `ResourceFetcher::MatchPreload` 不把 304 记为「已匹配消费」→ preload 残留 `is_unused_preload_=true` → load event 数秒后**误报**「preloaded using link preload but not used」——即使页面确实匹配并使用了该字体。
  - 修复 landed 约 Chrome 141+（2025 年末稳定版）。
- 本站 304 路径实证：字体带 `etag`（强校验器，curl 带 `If-None-Match` 实测回 **304**）。`cache-control: immutable` 下正常访问永不 revalidate，但**任何使缓存条目失去 freshness 的环境**（代理剥离、隐私策略、磁盘压力、CDN 变体）都会把请求推进 304 路径 → 旧内核误报。

### 2.3 复现矩阵：14+ 场景全绿（当前代码 + 新内核 = 测不出）

| 变量 | 取值 |
| --- | --- |
| 内核 | 系统 Chrome 153.0.8010.53、Playwright CfT 148 |
| 网络 | 直连、7890 代理（curl 实证代理完整透传 cache-control/ETag/304） |
| 身份态 | 无名（清 localStorage）/ 有名（预置 `ttt.room.name.v1`） |
| 路由 | `/`、`/online`（dev）、`/result?room=`（线上 main 无 /online，404 实证吻合分支拓扑：d07fd07 只在 dev） |
| 序列 | 冷首访、`reload()` ×3、bfcache `goBack()` |
| 环境 | 线上生产、本地 dev :3009、本地 build+:3101 |

全部场景 console 零 preload warning。本地 `sw-console-hygiene.mjs`（:3101 生产构建）7/7 PASS。

**反证结论**：偶发源不在当前代码，而在浏览器/CDN 的 preload 匹配机制内部——页面侧代码无法干预其匹配行为。

### 2.4 偶发源候选（按置信度排序）

1. **旧内核 304 误报**（高置信，机制有 Chromium 官方 CL 实证）：主公任一设备浏览器 <141，且该环境字体缓存条目失去 freshness → revalidate 304 → 误报。「偶发」= 与设备、缓存态、代理状态相关。
2. **Vercel Early Hints 部署窗口陈旧**（中置信）：部署换代 font hash 后，Vercel EH 缓存短窗口仍发旧 hash preload → 与新 CSS 引用不匹配 → stranded → 自愈。与「偶发」及主公部署节奏吻合。
3. 背景土壤：immutable 缓存被环境因素击穿后的一切 revalidate 序列。

**三源共同根：font preload 条目的存在本身。**

### 2.5 探针盲区（为什么现有探针恒绿）

`sw-console-hygiene.mjs` 的运行环境 = fresh context（零缓存态，永走 200 带体路径）+ 直连 + 最新 bundled 内核 + 无部署换代窗口——四个变量恰好全部避开 2.4 的偶发源。探针绿 ≠ 现场绿。

## 三、裁决 D-1：预案 B 触发——`Geist({ preload: false })`

上轮 plan 自设条款「**预案 B（仅当 Fix A 后警告仍存）**：`app/layout.tsx` 给 `Geist({...})` 加 `preload: false`」。主公本轮报告即触发条件成立，拍板执行。

**论证**：
- 偶发源全部长在「font preload 存在」这个前提上；拆除 preload 后，Link 头不再发 `as="font"` 条目，该 warning 在**任何浏览器版本 × 任何缓存态 × 任何代理 × 任何部署窗口**下物理不可能发生。治本，非治标。
- 收益端本已趋近于零：页面主文案是中文（Geist 无中文字形，fallback 系统字体渲染）；`/online` 开局空盘无 X/O 字形；拉丁字符由 `font-display: swap` + next/font 自动生成的 Geist Fallback（`size-adjust:104.76%` 同 metrics Arial）兜底，CLS 已被校准最小化。
- 代价（接受）：拉丁字形（X/O、pass-and-play、房间名）首帧晚 ~1 RTT 触发 FOUT→swap；国内+代理链路 ~0.3-1s，视觉上表现为 X/O 从 fallback 换到 Geist 的瞬时过渡。

**备选否决**：
- 「保留 preload + 页面侧修复匹配」：匹配判定在浏览器 network/blink 内部与 CDN EH 缓存里，页面无干预杠杆。
- 「手写 `<link rel=preload>` 替代 EH」：同样进 preload tracker、走同一 304 误报路径，且与 Next 生成机制冲突。
- 「只关部分路由」：preload 由 root layout 生成、全路由生效，per-route 关闭需 layout 重构，成本远超收益。

## 四、变更清单

1. **`app/layout.tsx`**：`Geist({...})` 加 `preload: false`（与 Geist_Mono 同型）；注释注明双字体均不 preload + 理由指向本 plan §2.4/§三。
2. **`tests/qa/sw-console-hygiene.mjs` 强化**（探针与线上机制重新接轨）：
   - 新增硬断言：`/` 与 `/online` 的响应头 `Link:` 中 **零 `as="font"` 条目**（防 preload 回归的治本断言）；HTML `link[rel=preload][as=font]` 计数为 0；
   - 新增 reload 场景（`reload()` 后等待窗口）console 零 preload warning（覆盖缓存态访问路径）；
   - 头部注释 `/play` → `/online` 清账（d07fd07 更名遗留）；step05 fallback 硬编码 hash 路径随 preload 拆除改为「断言无 preload link 即通过」。
   - LOW 顺手项：定位探针运行时 3 次 `[console:error] 404` 的资源来源并记录（不阻塞）。
3. **`public/sw.js` 头注释同步**：「next/font preload 优化」段更新为已拆除语境，防误导后来读者（语义零改动，纯注释）。

## 五、验收标准（机器可判）

| # | 命令/动作 | 判据 |
| --- | --- | --- |
| AC1 | `BASE_URL=http://localhost:3101 node tests/qa/sw-console-hygiene.mjs` | exit 0，含新增「Link 头零 font 条目」+ reload 场景断言 |
| AC2 | `pnpm vitest run && pnpm typecheck && pnpm lint && pnpm build` | 全 exit 0 |
| AC3 | `node tests/qa/commit-audit.mjs --branch dev` | 0 violations |
| AC4 | `git log -1` | Conventional + WHAT/WHY/HOW + lore trailer + `Plan:` 页脚；无 push |
| AC5 | 部署后（push 属主公决定）`curl -sI https://3t-tic-tac-toe.vercel.app/ \| grep -i '^link'` | 无 `as="font"` 条目；主公现场连续使用观察偶发警告归零 |

## 六、执行序（主公批准后）

1. 执行席（fresh session，herdr tab）：实施变更 1-3 → AC1-AC3 → 按提交契约 commit（禁 `--no-verify`、禁 push）。
2. 终验席（fresh-context 对抗）：复核 AC1-AC4，试图证伪「拆除后无回归」（FOUT 目测、探针新断言有效性、sw.js 注释与行为一致）。
3. 调度者汇总证据回禀；push 与部署后线上复查（AC5）留主公。

## 附：本轮调研的原始实测工件

- `/tmp/preload-304-probe.mjs`（首访+reload×3 状态码/警告采集）
- `/tmp/preload-named-probe.mjs`（无名/有名 × 五路由对照）
- `/tmp/preload-proxy-old-probe.mjs`、`/tmp/preload-bfcache-probe.mjs`
- 关键外部证据：Chromium CL 8280884 + Bug 517439604（304 误报）；Next.js #49607（preload 常规修复面）；Chrome Early Hints 预载措辞变体（chromium-discuss 2022）
