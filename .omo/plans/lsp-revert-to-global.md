# LSP 改回 vp 全局安装

## 决策
把 3 个 LSP server 从项目 devDependency（`fe892fb` 路径）改回 vp 全局安装
（`vp add -g`）。本地 devDep 是过渡方案，用户决定按 lsp-setup 的全局推荐走。

## 背景
- `fe892fb` 把 `typescript-language-server@6.0.0` / `bash-language-server@5.6.0` /
  `yaml-language-server@1.24.0` 作为项目 devDep 装到 `node_modules/.bin/`；
  `.codex/lsp-client.json` 用绝对路径 `command` 字段指向 `node_modules/.bin/`；
  AGENTS.md §本项目反模式 + `.github/copilot-instructions.md` Hard rules 各加一条
  「允许作为 devDep」例外条款。
- 理由：`vp add -g typescript-language-server` 后 server 报
  `Could not find a valid TypeScript installation`。
- 用户否决 devDep 与 symlink hack，决定按 lsp-setup 全局推荐走。

## 根因（2026-09-12 二次调研）
- vp 默认装 `typescript@7.0.2`，但 `typescript-language-server@6.0.0` 的
  peer dep 是 `typescript: ^6.0.3`（即 `>=6.0.3 <7.0.0`），TS 7 不满足。
- 即使把 typescript 降到 6.0.3，vp smart-shim 把每个 package 装到独立 hash
  目录（`~/.vite-plus/packages/<name>/<hash>/lib/node_modules/<pkg>/`），
  TLS 的 `findTypescriptVersion()` 走 userSetting → workspaceRoot →
  fallback → bundled 四条路径全找不到 typescript，仍然报
  `Could not find a valid TypeScript installation`，进程 exit 1 无 stderr。
- bash / yaml server 没有 peer dep 问题，vp shim 解析 + bare bin 名直起。

## 解决
1. `vp add -g typescript@6.0.3`：满足 TLS 6.0.0 peer dep；TS 6.0.3 仍在维护期。
2. `.codex/lsp-client.json` 用裸 bin 名（vp shim 在 PATH 第一位解析为
   `~/.vite-plus/bin/<name>`），typescrupt 额外加 `initialization.tsserver.path`
   指向 vp 装的 `bin/tsserver` 脚本（绝对路径，含 install hash）。
3. 删除 `/opt/homebrew/bin/` 下三 symlink（`typescript-language-server`、
   `bash-language-server`、`yaml-language-server`，均指向项目
   `node_modules/.bin/`）：symlink 是 hack 技巧，不推荐。
4. `pnpm remove typescript-language-server bash-language-server yaml-language-server`：
   从 `package.json` + `pnpm-lock.yaml` 移除 devDeps。

## TLS 启动验证（手动 roundtrip）
- `typescript-language-server --stdio`（裸，无 tsserver.path）→ exit 1 无 stderr。
- `bash-language-server start`（裸）→ initialize 返回 capabilities（OK）。
- `yaml-language-server --stdio`（裸）→ initialize 返回 capabilities（OK）。
- `typescript-language-server --stdio` + initOptions `tsserver.path` →
  initialize 返回 capabilities（OK）。
- 验证脚本：`node /tmp/tls_probe2.mjs`，用
  `<个人家目录>/.vite-plus/packages/typescript/c030a1df-.../bin/tsserver`
  作 `tsserver.path`。

## 风险与约束
- `tsserver.path` 含 vp install hash（`<个人家目录>/.vite-plus/packages/
  typescript/<hash>/bin/tsserver`）。vp 重装 typescript 会换 hash，
  需要同步更新 `.codex/lsp-client.json`，否则 TLS 启动失败静默 exit 1。
- 用户态 `vp exec tsc` 从 `typescript@7.0.2` 降到 `typescript@6.0.3`；
  项目自身 TS devDep 不变（影响隔离在 vp 全局 namespace）。
- 不影响 Next.js runtime bundle。

## 反向操作（rollback to local devDep）
若未来想回到本地 devDep：
1. `vp rm -g typescript typescript-language-server`
2. `pnpm add -D typescript@6.0.3 typescript-language-server@6.0.0`
3. `.codex/lsp-client.json` 删 `initialization.tsserver.path`，`command`
   改回绝对路径 `["<repo-root>/node_modules/.bin/<name>", ...]`
4. AGENTS.md 把本条 bullet 改回 devDep 版本（参考 `.omo/plans/lsp-project-local-setup.md`）

## 与既有规则的关系
- AGENTS.md §本项目反模式 第 7 条「不要引入新 npm 依赖」维持不变，但加 LSP 例外
  描述方式从「允许作为 devDep」改为「走 vp 全局安装，禁止作为 devDep」。
- `.github/copilot-instructions.md` Hard rules 同条款同步改写。
- 不影响 §验证门禁 on-demand 规则（`pnpm vitest run` + `pnpm typecheck` 仍必跑）。
