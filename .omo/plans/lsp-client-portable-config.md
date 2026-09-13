# .codex/lsp-client.json 去机器本地化（可移植最小形态）

## 决策
把 `.codex/lsp-client.json` 缩成可移植最小形态：每个 entry 只保留 `id` +
`priority`，删除 typescript entry 的 `initialization.tsserver.path`（含 vp
install hash 的机器本地绝对路径）和三个无效的 `command` 字段。该文件仍被 git
跟踪，但不再包含任何机器本地数据——其他克隆者拿到的是同样有效的配置。

## 背景
`b146e50` 为解决「vp smart-shim 把 typescript 装到独立 hash 目录、TLS 找不到」
的问题，在 `.codex/lsp-client.json` 写入了
`initialization.tsserver.path = <个人家目录>/.vite-plus/packages/typescript/
c030a1df-…/bin/tsserver`。问题：
1. 该路径推上 GitHub 后其他克隆者不存在，fresh clone 即坏；
2. vp 重装 typescript 会换 hash，本机也会静默失效（TLS exit 1 无 stderr）；
3. 路径属于用户本地环境，不该进版本库。

## 运行时语义（读已安装 omo 4.19.4 dist 实证，非记忆）
消费方是 omo 插件的 lsp 组件（`@code-yeongyu/lsp-tools-mcp` 运行时），位于
`~/.codex/plugins/cache/sisyphuslabs/omo/4.19.4/components/lsp/dist/cli.js`：

1. **project-source entry（id 命中 builtin 时）**：`command` 取 builtin 定义
   （项目里写的 `command` 被忽略），`extensions` 取 builtin，`priority` 取
   entry，`initialization` 原样透传。三个 id（typescript / bash / yaml-ls）
   都是 builtin，故 `command` 字段从来就是装饰品。
2. **initialize 恒带 workspace 根**：`rootUri` + `rootPath` +
   `workspaceFolders: [{uri, name: "workspace"}]`，
   `initializationOptions: server.initialization`。
3. **TLS typescript 解析顺序**（读 vp 安装的
   typescript-language-server `cli.mjs` 实证）：userSetting
   （`tsserver.path`）→ workspace（`<workspaceRoot>/node_modules/typescript/lib`）
   → fallback → bundled。workspace 命中即返回。

本项目 devDep 就有 `typescript@5.9.3`（`node_modules/typescript/lib/tsserver.js`
存在），因此 codex-lsp 启动 TLS 时 **workspace 解析天然命中，无需任何
`tsserver.path` override**。`lsp-revert-to-global.md` 当时「workspaceRoot 找不
到 typescript」的结论来自不带 workspaceFolders 的手工探针，前提不成立。

## 实证（2026-09-12）
探针完全复刻 connection.ts 的 initialize 形状（含 workspaceFolders，**不含**
initializationOptions）：

| 用例 | 结果 |
| --- | --- |
| 本项目根 `/private/tmp/tic-tac-toe`，无 tsserver.path | PASS：initialize 返回 capabilities（hover/definition/documentSymbol 均 true） |
| `/tmp/no-ts-workspace`（无 node_modules/typescript），负对照 | FAIL：`Could not find a valid TypeScript installation`（exit 1，与 plan 里记录的故障一致） |
| 本项目 + `textDocument/documentSymbol` on `lib/game.ts` 端到端 | PASS：返回 16 个符号（applyMove / Board / checkWinner / …） |

生产实际行为核对：omo 4.19.4 对 project-source entry 透传 `initialization`，
即 hash 路径此前确实被发送过；但 TLS 同时也会做 workspace 解析，去掉后行为
不变（上表第 1、3 行）。

## 改动清单
- `.codex/lsp-client.json`：三个 entry 缩为 `{"priority": 100}`。
- `AGENTS.md` §本项目反模式 LSP bullet：删除 tsserver.path workaround 描述，
  改为「配置必须可移植，禁止 install hash / 机器本地绝对路径」契约。
- `.github/copilot-instructions.md` Hard rules 对应条款同步。

## 被否决的替代方案
- **gitignore 该文件 + 提交 example 模板**：codex-lsp 无 env 展开、无模板
  机制，fresh clone 仍缺配置；且 builtin 已覆盖全部三个 id，模板是噪音。
- **保留 hash 路径仅本地改、仓库留旧版**：会造成本机与仓库行为分叉，且
  hash 重装后两边都坏，违背「单一事实源」。
- **wrapper 脚本动态解析 hash**：`command` 对 project-source entry 被忽略
  （见运行时语义 1），wrapper 根本不会被调用。
- **删除整个文件**：可行但丢失「本项目显式声明需要 TS/bash/yaml LSP」的
  契约锚点；保留 id+priority 成本为零且可对抗 user 级配置漂移。

## 风险与约束
- vp 全局 `typescript@6.0.3` 安装保持不动：它仍作为 TLS 在无 typescript
  工作区（非项目上下文）的 fallback + 全局 peer dep 满足项。
- fresh clone 贡献者：`pnpm install` 后 workspace 解析命中项目自身
  typescript；未 install 则 LSP 与构建同样不可用，行为一致。
- 不动 vitest / eslint / Next.js runtime；无 lib/db 改动，coverage / mutation
  on-demand 门禁不触发。

## 反向操作
若未来确需 per-machine tsserver override：写入 user 级
`~/.codex/lsp-client.json`（不入库），项目文件保持可移植。
