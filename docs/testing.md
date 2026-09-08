# 测试思路（Testing Strategy）

> 面向人类读者的测试分层说明。命令速查见 [operations.md](operations.md)；
> 提交前门禁清单见 AGENTS.md「Verification gate」。

## 分层模型（由内向外）

| 层 | 位置 | 工具 | 锁什么行为 |
| --- | --- | --- | --- |
| L1 纯函数 + 属性 | lib/game.test.ts | vitest + fast-check | 棋盘/胜负/战绩纯逻辑；不变量（otherPlayer 对合、recordOutcome 单调、空格计数一致，200 次采样） |
| L2 状态集成 | tests/store/store.test.ts | vitest + fetch mock | Zustand 状态机与 /api/stats GET/PUT/DELETE 契约、网络失败回退 |
| L3 数据层 | tests/db/db.test.ts | vitest + @libsql/client | 真本地 sqlite file: 往返 + spy http(s) 分支；每测试 tmpdir 隔离 + 模块 reset |
| L4 组件 | components/SoundToggle.test.tsx | RTL + renderToString | 交互回归 + SSR 输出恒为静音（hydration 防护） |
| L5 音频/庆祝 | lib/sound.test.ts, lib/confetti.test.ts | vitest + mocks | Web Audio 振荡器计数、cheer 序列、confetti 形状、reduced-motion no-op |
| L6 浏览器 QA | tests/qa/*.mjs | Playwright（真实 server） | 真实 AudioContext 探针（计数/频率/时序）、hydration 警告监听、UX 合约断言、截图证据 |
| L7 变异 | pnpm test:mutation | Stryker（scope: lib/ + db/） | 套件敏感性本身；Vitest runner 由本仓库补丁适配 Vitest 5 |

## 阈值

vitest coverage（`pnpm test:coverage`）：lines/functions/statements ≥ 80%，branches ≥ 70%，
范围 lib/** + db/**。配置在 vitest.config.ts，是唯一事实源。

## RED-first 政策

- 行为修复：先写/先捕获失败证据（RED），再修（GREEN）。测试无法自然失败时（回归锁定已正确行为），
  用突变探针替代：临时破坏被测语义 → 捕获目标测试失败 → 回滚。
- 清理/重构：先跑绿基线，再动代码；行为等价性由既有套件证明，不做"顺手改语义"。
- PROSE 文档不做人为"关键词/字数"测试；机器消费的值由真实工具验证
  （如 commit-audit 检查提交消息、vitest 检查代码行为）。

## 结构与可测性约定（深模块）

- 出现在两个以上 UI 文件里的派生逻辑（格式化、标签计算）必须下沉 lib/ 纯函数——
  既消除复制漂移，也让它进入单测射程（案例：streakLabel 曾在 home/result 各复制一份且零测试）。
- 交互组件不自带 focus-visible 样式：全局 :focus-visible 规则（globals.css）是 DESIGN §6 契约的
  唯一实现，组件层重复声明属于 slop。
- 布局壳（.page-shell）与动画（page-fade-in 等）一样是 CSS 令牌，JSX 只引用不复制。
- 第三方效果把真实 DOM 挂到 React 树外时（如 canvas-confetti），组件要暴露一个无交互、
  aria-hidden 的稳定契约层；QA 观察挂载契约，而不是搜索实现私有的全局节点。

## 浏览器 QA 探针设计

- 全部对生产构建（pnpm build && pnpm start）运行，不用 dev server，避免 HMR 噪声。
- 音频探针通过给 AudioContext 打补丁统计振荡器数量/频率/创建时间，证明合成路径真实存在
  （headless 无法真正"听到"）；win→cheer 的 360ms 间隔用时间戳断言。
- 先手随机：所有对局脚本用固定序列 0,3,1,4,2，保证"任意先手都赢上排"，探针不依赖硬币。
- 证据落点 .omx/evidence/<script>/（截图 + qa-log.json），.omx/ 已 gitignore。

## 当前规模

vitest：84 例（6 文件，含 property 与 DB 集成）。QA 脚本 7 个（hydration / audio×2 / confetti / ux / visual / commit-audit）。
变异测试：Stryker 只对 lib/game.ts、lib/db.ts、lib/store.ts、db/schema.ts 做变异（stryker.config.mjs），
分数为信息性门禁（break: null），结果在 reports/mutation/。

本轮深模块清理后：258 个突变中 217 个被杀、1 个超时、38 个存活、2 个无覆盖，总分 84.50%。
存活突变按“可观察行为缺口 → 修测试；环境生命周期、依赖元数据或被吞掉的内部错误信息 → 记录保留”分类。
Stryker 10 的 Vitest runner 假定 Vitest 6 的测试名格式，空格连接会误选 0 个测试；
仓库用 `patches/@stryker-mutator__vitest-runner@10.0.0.patch` 把过滤模式适配回 Vitest 5 的
`suite > test` 语义。上游修复后可删除补丁并重跑变异基线。
