# Deep module dedup design record

## Intent

第二轮清理的目标不是把“长得像”的代码强行合并，而是把重复逻辑移到更深的少数所有权层：
小接口在调用点使用，复杂规则和副作用隔离在实现内。行为先由回归套件锁定，再做结构收敛。

## Boundary decisions

- `streakLabel` 从 home/result 两份 JSX 复制下沉到 `lib/game.ts`。它是纯领域派生逻辑，
  放在游戏层可获得单测和变异测试射程；UI 只消费标签。
- home/result 共同的战绩网格收敛为 `components/ui/StatsGrid.tsx`。组件接口只接收 stats，
  不把 label 规则、grid class 或状态语义泄漏回页面。
- 页面壳统一为 `.page-shell` CSS token；focus 指示返回 `globals.css` 的全局
  `:focus-visible` 规则。全局样式是平台已有所有权，不新增组件级实现。
- 删除 home 页重复 hydrate effect、API route 的 dead import、result 页空 effect，以及 store 内
  `win.player === currentPlayer` 恒真分支。分支不变量已写成 WHY 注释：winner 只会在当前玩家
  落子后由 `checkWinner` 产生。
- `Confetti` 在 React 树外挂载真实画布；组件保留一个无交互、对辅助技术隐藏的稳定层，
  让浏览器 QA 能观察庆祝是否挂载，而不是探测实现细节或猜测全局 canvas 归属。

## Test strategy

重构前保持 vitest 绿基线；新增测试锁 API URL/method/headers/body、GET/PUT/DELETE 失败回退、
胜负和平局音效、SQLite 物理 schema。先手 RNG、连胜切换、和 `streakLabel` 的边界也补窄测试。
不对 prose 文档造字数或关键词测试；文档由人类评审和提交审计覆盖。

## Mutation compatibility

Stryker 10.0.0 的 Vitest runner 用空格拼接测试名，而 Vitest 5 使用 `suite > test`，
导致部分突变实际运行 0 个测试后误报存活。仓库采用 pnpm patch 修改过滤 regex，并记录
`pnpm-workspace.yaml`。升级 Stryker/Vitest 后先重跑变异，再决定是否删除补丁。

本轮最终变异基线：258 mutants，217 killed，1 timeout，38 survived，2 no coverage，总分 84.50%。
继续保留的突变集中在环境生命周期（模块级 SSR guard、真实文件系统 DB 路径）、依赖生成的 schema
元数据，以及被调用方吞掉、不属于公共契约的错误文案。这些用集成/浏览器 QA 与本记录解释，
不为分数添加实现细节断言。

## Verification gates

常规门禁记录：vitest 78/78、coverage exit 0、typecheck exit 0、lint exit 0、build exit 0。
浏览器验收必须对 `pnpm start` 的生产构建执行 hydration、audio、confetti、UX、visual 脚本；
结束时要释放 :3000。提交按 testing fix、refactor、docs 三个原子主题拆分。

最终验收记录：hydration、audio-probe、audio-cheer、audio-confetti、UX strict、visual 六项全部
PASS；QA 后 :3000 无监听进程。最终门禁在 Confetti 契约层补充后重跑，结果仍全部 exit 0。
