# Plan: @types/node 对齐 Node 24 运行时（2026-09-24）

## 背景

- 项目运行时三处一致锁 Node 24：`package.json` engines `"24.x"`、`.nvmrc` 24、`ci.yml` 全部 job `node-version: 24`。
- `devDependencies` 里 `@types/node` 却停在 `^20`（解析 20.19.43），落后运行时两个大版本——历史欠账。
- Dependabot 2026-09-21 开出 major 跳变 PR #13（`^20` → 26.6.1，后自行动到 26.6.2），CI 绿但方向过冲。

## 裁决

- 拒绝 #13：`@types/node` 的大版本必须对齐运行时大版本。升 26 会让 typecheck 按 Node 26 的 API 面校验——代码引用 Node 26 才有的 API 时编译通过、Node 24/Vercel 运行时才暴露，类型层给出虚假安全。
- 目标定 `^24`：修复错位而非跟跳 major；合入后 Dependabot 自动按 24.x 跟进后续 patch。
- 配套：#13 已关闭（附理由评论）；依赖补丁批 PR #15 合入后 main 打 v2.0.1。

## 执行

- 分支 `chore/types-node-align-24`：`package.json` `^20`→`^24` + `pnpm-lock.yaml` peer 引用换树（24.13.6），零业务代码改动。

## 验证

- 本地：`pnpm typecheck` PASS；`pnpm test` 498/498（2026-09-24，Node 22 本机 + 类型 24 通过）。
- CI：六层门禁（Node 24 环境）以 PR checks 为准。
