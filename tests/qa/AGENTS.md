# tests/qa/ 代理说明

面向生产服务的 Playwright 探针，以及仓库提交策略审计器。

## 运行模型

- 先启动构建后的应用：pnpm build && pnpm start。
- BASE_URL 默认 http://localhost:3000；EVIDENCE_DIR 默认放在 .omx/evidence/ 下。
- browser.mjs 统一管理 Chromium 启动、context、viewport 和可选 autoplay policy。
- driveTopRowWin 依次点击 0,3,1,4,2，让任意随机先手都赢上排。
- evidence.mjs 创建目录、截全页图，并写入 qa-log.json。
- UX_STRICT=1 启用 ux-contract.mjs 里的额外无障碍、布局和动效断言。

## 探针地图

| 脚本 | 证明内容 |
| --- | --- |
| visual-qa.mjs | 路由流程、胜局、刷新持久化、API 响应和截图 |
| rooms-race-qa.mjs | `/api/rooms` 链竞态端到端（merge×outcomes 累加、reset×in-flight、POST 幂等、404+banner、SW non-GET、慢 DB ordering+DOM===API） |
| hydration-check.mjs | 持久化“取消静音”后没有 hydration 错误 |
| audio-probe.mjs | 至少 12 个 Web Audio oscillator 和匹配的 gain 使用 |
| audio-cheer.mjs | win-to-cheer 360ms 时序和精确欢呼频率程序 |
| audio-confetti-qa.mjs | 静音持久化、fixed 彩纸 canvas、结果文本、战绩持久化 |
| confetti-origin-qa.mjs | 桌面内聚起点与较小视口的边缘起点 |
| ux-qa.mjs | 场景截图；可选 strict UX contract |
| commit-audit.mjs | Conventional subject、WHAT/WHY/HOW、必要 trailer/plan；也是 commit-msg hook |

## 约定

- 断言可观察的浏览器/API 结果，不要依赖实现私有细节。
- 成功和失败路径都关闭 ctx 与 browser；退出前写入证据。
- 通过 API 重置或构造战绩，让场景保持确定性。
- data-testid 和 localStorage 是探针契约，必须保留。
- 共享行为放进 tests/qa/lib，不要复制浏览器 setup 或胜局脚本。
- ESLint 把此目录视为普通 QA JavaScript 并忽略；实际执行就是它的验证。

## 反模式

- 契约要求生产构建时，不对 dev server 跑 QA。
- 胜局流程不假设固定 X/O 先手；先手是随机的。
- headless 音频不做真实听感断言；要 instrument Web Audio 节点。
- 修改提交消息策略时，必须同步 auditor、commitlint config 和文档，不能只改一处。

## 时序敏感断言（2026-09-23 新增）

- 时序断言锚定到**动作时刻**（click 前后取时钟差中位），不锚定 `waitForLoadState` / `waitForTimeout` 等相对量——相对量的真实耗时随环境浮动，断言时刻与被测时刻两侧都是未知量时，断言没有保护力。
- 「错峰 / 延迟」类行为要**双沿钉**：既有「T 内不发生」上界，也有「不早于 T2 才发生」下界（防止回归把延迟改没了还能 PASS）。
- 机制类探针（验证走哪条代码路径）配**结构化诊断输出**（`[step][diag]` 行，含事件名 / 伪元素 / 事件计数字段），让 future outlier 可证伪；实测样本与异常样本都入档 plan。
- 阈值必须有推导依据（动画时长 + commit 余量 + safety 上限），写入 plan；禁拍脑袋数。
- 实证：`home-return-qa.mjs` step 02c（clickToOpen 实测 327~354ms、animationend margin ~137ms、600ms safety 未触发；1/5 run 的 -1338ms 异常靠诊断字段 `evtName/evtPseudo/evtCount` 闭合）。
- 02c EARLY 阈值（100ms）暂不放宽；CI 首次 flake 时读 DIAG 行 `clickToOpenMs`，若 path C 实测 >80ms 则 EARLY = 实测 P99 + 20ms（判据来源：`.omo/decisions-20260923.md` 项 3）。

