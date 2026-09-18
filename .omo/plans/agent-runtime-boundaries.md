# Plan: 运行时能力边界与任务分派规则落档（项目级 AGENTS.md 衔接全局真源）

状态：已实施（2026-09-18）

## 意图

把「不同 Agent 运行时（Pi / omp 等）的能力边界与适配任务」纳入项目级规范，让任何
调度者（人类 / 同晓 / herdr 派发）与本仓库协作时先做「任务类型 ↔ 运行时工具面」
匹配，避免派错运行时导致的目标漂移、跨文件漏改与伪完成。

## 调研依据

1. 全局真源已于同日落档：`~/.hermes/references/ag-agent-runtime-capability-boundaries.md`
   v1.0.0（Router 镜像 `~/.hermes/AGENTS.md` § 2 第 21 条，hermes 仓库 commit `2c08b78b`）。
   项目层不复制大表（AGENTS.md Router 形态既有决策，见 agents-md-slim.md），只放
   digest + 指针 + 项目特化焊接点。
2. 项目已有两块相邻契约：`.omo/plans/agent-session-isolation.md`（一子任务一干净
   session）与 dispatcher-roles-retrospective.md §4（调度者不亲自写主线代码）。新规则
   是它们的上游——先回答「派给谁」，再执行「怎么隔离」与「怎么派发」。
3. omp（oh-my-pi）与 Pi（0 插件）能力事实以 `~/.codex/AGENTS.md` 特殊提示区为既有
   真源；本 plan 不重复工具清单，只落分派判定。

## 决策

1. **验收与 runtime 解耦**：无论派给哪个 runtime 执行，§验证门禁六层全绿才准提交。
   能力差异只影响「谁来写」，不影响「怎么验」——这是项目契约不被低能力 runtime
   稀释的护栏。
2. **无浏览器 runtime 的 UI 契约验证走 tests/qa/*.mjs headless 探针**：探针断言
   data-testid 与网络行为，不需要肉眼。这把全局规则「无浏览器禁派视觉验证」转译成
   项目内的可行路径：UI 契约验证可派 Pi/omp，「看渲染效果」才需要带浏览器的
   runtime 或人类（浏览器 QA 用生产构建，不用 dev server，既有反模式不变）。
3. **lib/game.ts / lib/store.ts 高危面禁低能力 runtime 裸改**：§查找入口表已约定
   必跑对应 vitest / Stryker / fast-check；分派时这两个文件的任务优先给带 LSP /
   完整测试工具面的 runtime，或由调度者代跑 on-demand 三层。
4. **.omo/plans/ 设计记录先行 + wave 拆解与 wayfinder「地图 + 工单」同构**：plan =
   地图，wave/task = 工单；每个子任务新开干净 session（衔接 §herdr 多代理 session
   卫生）。宏大长程目标不直派任何单会话 runtime。
5. **落点**：AGENTS.md 新小节「运行时能力边界与任务分派」置于「调度者（多代理
   编排）」之后、「herdr 多代理 session 卫生」之前（调度链阅读顺序：派给谁 →
   怎么派 → 怎么隔离）；≤ 10 行 digest，细节回读全局真源。

## 变更面

- `AGENTS.md`：+1 小节（约 8 行）。
- `.omo/plans/agent-runtime-boundaries.md`：本设计记录。

## 验收

- [x] AGENTS.md 新小节命中「运行时能力边界与任务分派」，且指向全局真源路径。
- [x] 小节显式衔接 agent-session-isolation 与验证门禁（不重复大表、不新增第二真源）。
- [x] docs-only 变更：vitest / typecheck / lint / build 四层全绿；不触及浏览器界面，
      第 ⑥ 层按门禁定义不适用。
- [x] 提交带全套 lore trailer + Plan footer，过 commit-msg hook（0 violations）。

## 修订（2026-09-18 · v1.0.1）

主公纠正：视觉能力模型都有（多模态），浏览器控制在仓库内已有集成代码
（tests/qa/ Playwright 探针 + launchQA）。决策 2 原文「无浏览器 runtime 禁派
视觉验证……才需要带浏览器的 runtime 或人类」过严，修正为：**视觉/UI 验证 =
bash 跑仓库内探针拿断言 + 截图由模型直读**，无浏览器工具不构成障碍；禁的是
不跑探针、不看截图的凭空「样式确认」。全局真源同步升 v1.0.1。

## 撤销

`git revert` 本提交即可；AGENTS.md 小节整体删除 + 本 plan 移档归档，无代码面影响。
