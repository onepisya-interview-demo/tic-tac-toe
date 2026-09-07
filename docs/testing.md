# 测试思路（Testing Strategy）

> 面向人类读者的测试分层说明。命令速查见 [operations.md](operations.md)；
> 提交前门禁清单见 AGENTS.md「Verification gate」。

## 分层模型（由内向外）

| 层 | 位置 | 工具 | 锁什么行为 |
| --- | --- | --- | --- |
| L1 纯函数 + 属性 | lib/game.test.ts | vitest + fast-check | 棋盘/胜负/战绩纯逻辑；不变量（otherPlayer 对合、recordOutcome 单调、空格计数一致，200 次采样） |
| L2 状态集成 | tests/store/store.test.ts | vitest + fetch mock | Zustand 状态机与 /api/stats GET/PUT/DELETE 契约、网络失败回退 |
| L3 数据层 | tests/db/db.test.ts | vitest + better-sqlite3 | 真 SQLite 往返；每测试 tmpdir 隔离 + 模块 reset |
| L4 组件 | components/SoundToggle.test.tsx | RTL + renderToString | 交互回归 + SSR 输出恒为静音（hydration 防护） |
| L5 音频/庆祝 | lib/sound.test.ts, lib/confetti.test.ts | vitest + mocks | Web Audio 振荡器计数、cheer 序列、confetti 形状、reduced-motion no-op |
| L6 浏览器 QA | tests/qa/*.mjs | Playwright（真实 server） | 真实 AudioContext 探针（计数/频率/时序）、hydration 警告监听、UX 合约断言、截图证据 |
| L7 变异 | pnpm test:mutation | Stryker（scope: lib/ + db/） | 套件敏感性本身 |

## 阈值

vitest coverage（`pnpm test:coverage`）：lines/functions/statements ≥ 80%，branches ≥ 70%，
范围 lib/** + db/**。配置在 vitest.config.ts，是唯一事实源。

## RED-first 政策

- 行为修复：先写/先捕获失败证据（RED），再修（GREEN）。测试无法自然失败时（回归锁定已正确行为），
  用突变探针替代：临时破坏被测语义 → 捕获目标测试失败 → 回滚。
- 清理/重构：先跑绿基线，再动代码；行为等价性由既有套件证明，不做"顺手改语义"。
- PROSE 文档不做人为"关键词/字数"测试；机器消费的值由真实工具验证
  （如 commit-audit 检查提交消息、vitest 检查代码行为）。

## 浏览器 QA 探针设计

- 全部对生产构建（pnpm build && pnpm start）运行，不用 dev server，避免 HMR 噪声。
- 音频探针通过给 AudioContext 打补丁统计振荡器数量/频率/创建时间，证明合成路径真实存在
  （headless 无法真正"听到"）；win→cheer 的 360ms 间隔用时间戳断言。
- 先手随机：所有对局脚本用固定序列 0,3,1,4,2，保证"任意先手都赢上排"，探针不依赖硬币。
- 证据落点 .omx/evidence/<script>/（截图 + qa-log.json），.omx/ 已 gitignore。

## 当前规模

vitest：67 例（7 文件，含 property 与 DB 集成）。QA 脚本 7 个（hydration / audio×2 / confetti / ux / visual / commit-audit）。
