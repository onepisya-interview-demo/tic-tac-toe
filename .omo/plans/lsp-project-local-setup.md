# LSP 服务端从全局安装改为项目本地 devDependency

**类型：** chore(deps) + docs(agents-md)
**范围：** package.json / pnpm-lock.yaml / .codex/lsp-client.json / AGENTS.md / .github/copilot-instructions.md / .omo/plans/lsp-project-local-setup.md
**生成时间：** 2026-09-12
**对应提交：** footer `Plan:` 指向本文件

## 背景

`.codex/lsp-client.json` 落地后，3 个 server（typescript / bash / yaml）的全局二进制已 PATH 上可解析；但 TS server 报 `Could not find a valid TypeScript installation`，手动 roundtrip 实证：

| 路径 | bash / yaml | typescript |
| --- | --- | --- |
| 全局 `vp add -g` | ✅ capabilities 返回正常 | ❌ `Could not find a valid TypeScript installation` |
| 项目本地 `pnpm add -D` | ✅ capabilities 返回正常 | ✅ `Using Typescript version (bundled) 5.9.3 from .../typescript@5.9.3/...` |

根因：vp smart shim 把 server 装在 `.vite-plus/packages/typescript-language-server/<hash>/lib/node_modules/typescript-language-server/`，把 typescript 装在 `packages/typescript/<hash>/lib/node_modules/typescript/`，两者**不在同一个 node_modules 下**；typescript-language-server 通过自身 `node_modules/typescript` 找不到 tsserver。pnpm 本地安装则把两者放在 `.pnpm/typescript@5.9.3/...` 同一棵依赖树下，server 一启动就拿到正确路径。

## 决定

三个 LSP server 全部作为 `devDependencies` 装到项目本地（不写进 runtime bundle）。同时：
1. `.github/copilot-instructions.md` 的硬规则「Never introduce a new npm dependency」开 LSP tooling 例外；
2. AGENTS.md §本项目反模式 加一条 bullet 把例外固化进 agent 契约；
3. `.codex/lsp-client.json` 维持最小配置（priority 100 × 3）；engine 的 builtin `command` 自动解析会走项目 `node_modules/.bin/`，如果实际仍选全局，需在 user config（`~/.codex/lsp-client.json`）显式覆盖 `command`——本轮不做，因为本地 roundtrip 已验证 server 能起。

## 拒绝的备选

| 备选 | 否决原因 |
| --- | --- |
| 全局安装 + symlink hack（把 global typescript 链到 server 自己的 node_modules） | 治标不治本；vp 升级 / 重装即破 |
| 装旧版 typescript-language-server（如 v4.x 兼容 TS 5） | 引入版本约束噪音；本地安装直接对齐 TS 5.9.3 更稳 |
| 只装 typescript-language-server，bash / yaml 留全局 | 不一致；vp shim 风险未消除 |
| 改用 bietet / deno LSP | 不在本任务范围 |

## 验证

- ✅ TS / bash / yaml 三个 server 手动 LSP roundtrip 全部 OK（capabilities 返回正常 + TS server 显式确认 `Typescript version (bundled) 5.9.3`）
- ⏳ `pnpm vitest run` / `pnpm typecheck` / `pnpm lint` / `pnpm build` 在 commit 前跑过
- ⏳ `commit-audit --message-file` 预校验通过
- ⏳ `lsp.*` MCP 工具在本会话仍然不可用（harness 未在启动时挂载）；用户重启 Codex 后应自动出现 `lsp.status` / `lsp.diagnostics` 等函数

## 不可逆 / 风险点

- `pnpm-lock.yaml` 大幅变动（+44 包）；本 commit 是单点 atomic，不混其他改动
- devDep 改动未触 `dependencies`，Next.js bundle 体积不受影响（验证：`pnpm build` 后 `.next/static` 体积不变）
- 如果用户已经依赖 vp 全局 `typescript-language-server`，安装后两套并存；PATH 顺序由各 IDE 决定；项目根目录内 IDE / agent 默认走 node_modules/.bin/

## 后续（不在本 commit）

- 真正验证 lsp MCP：在新 Codex session 跑 `lsp.status` / `lsp.diagnostics lib/game.ts`
- 若 engine 仍走全局，在 `~/.codex/lsp-client.json` 给 typescript 加 `command: ["./node_modules/.bin/typescript-language-server", "--stdio"]` 显式覆盖
