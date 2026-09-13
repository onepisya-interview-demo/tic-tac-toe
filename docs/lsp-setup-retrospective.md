# LSP 配置复盘（LSP setup retrospective）

> 仓库 LSP 配置三次演进（`fe892fb` → `b146e50` → `566745f`）的单一事实源。
> 覆盖运行时语义、Plan 间冲突与被证伪声明、坑清单、SOP。技术断言逐条标注
> 出处（commit / plan / dist 源码位置 / 探针输出）；无出处的标「未验证」。

## 1. omo LSP 架构

### 1.1 运行时

- **CLI/MCP 入口**：`@sisyphuslabs/omo` 插件的 `lsp` 组件，编译产物
  `~/.codex/plugins/cache/sisyphuslabs/omo/4.19.4/components/lsp/dist/cli.js`
  [本机 `ls` 验证]。CLI 表面挂三个子命令：`mcp` / `hook post-tool-use` /
  `hook post-compact` [本机 `node ~/.codex/.../cli.js --help` 验证]。
- **lsp-tools-mcp 引擎**：omo 内部的 LSP 工具运行时，源码
  `packages/lsp-tools-mcp/src/*` 仅在 omo 仓库内部存在，**不在 omo 4.19.4
  插件 cache 中分发**（omo 只发 dist bundle）[本机 `find ~/.codex/plugins/
  cache/sisyphuslabs/omo -name tools.ts -path "*lsp-tools-mcp*"` 返回空 + 
  verify-lsp.ts 报 `EngineNotFoundError` 验证]。
- **post-tool-use 诊断 hook**：`omo-lsp hook post-tool-use` 在 agent 改完文
  件后自动跑 `diagnostics`，把 LSP 错误注入下一步上下文
  [omo:lsp SKILL.md "Tools" 节；未验证 cli.js 内 hook 实现细节]。

### 1.2 配置三来源合并（omo 4.19.4 dist 实证）

加载路径见 `cli.js` 行 5768：

| 来源 | 路径 | 优先级 |
|---|---|---|
| project | `<cwd>/.codex/lsp-client.json` | 0（最高） |
| user | `~/.codex/lsp-client.json` | 1 |
| builtin | `BUILTIN_SERVERS`（`cli.js` 行 3683） | 2（最低） |

合并语义（`cli.js` 行 3845-3910）：

- 对每个 entry 调用 `createServerFromEntry(id, entry, source)`。
- `source === "project"` 且 id 命中 builtin：**强制使用 `builtin.command`**，
  entry 里写的 `command` 字段被忽略（行 3874-3876）；`extensions` 取 entry
  ?? builtin；`priority` 取 entry；`initialization` 原样透传。
  [cli.js 行 3870-3882 + 上一轮 `node /tmp/lsp-verify/source-installed.js`
  模拟输出 `source=project command=["typescript-language-server","--stdio"]
  installed=true`，三 server 全部命中]。
- `source === "user"`：允许自定义 `command` 与 `extensions`，是 per-machine
  override 的合法落点 [cli.js 行 3895-3904 + commit `566745f` WHY 段]。
- builtin 默认见 `cli.js` 行 3683-3700+；本项目用到的三个 id（`typescript` /
  `bash` / `yaml-ls`）全部内置，对应 `command` 分别为
  `["typescript-language-server","--stdio"]` /
  `["bash-language-server","start"]` /
  `["yaml-language-server","--stdio"]` [cli.js 行 3683-3698]。
- `isServerInstalled(command)`：`cli.js` 行 3977-4010，对裸 bin 名做 PATH
  查找；命中 `existsSync(join(p, cmd + suffix))` 即 true。

### 1.3 initialize 恒带 workspaceFolders

omo lsp 组件发出的 `initialize` 请求恒带 `rootUri` + `rootPath` +
`workspaceFolders: [{uri: "file://<cwd>", name: "workspace"}]`，且
`initializationOptions: server.initialization` [commit `566745f` HOW 段 +
plan `lsp-client-portable-config.md` §运行时语义 2；未验证 dist 中具体发
包代码行号，但上一轮手工 JSON-RPC probe 复刻 `rootUri + workspaceFolders`
形状即让 `documentSymbol` 成功返回 16 符号，旁证 initialize 形状正确]。

### 1.4 TLS typescript 解析链

typescript-language-server（vp 全局 `typescript-language-server@6.0.0`，
安装在 `~/.vite-plus/bin/typescript-language-server` [本机 `which` + `vp
ls -g` 验证]）的 typescript 解析顺序：

```
userSetting (initialization.tsserver.path)
  → workspaceRoot/<workspace>/node_modules/typescript/lib
    → fallback
      → bundled (TLS 自带 tsserver)
```

任一条命中即返回 [plan `lsp-client-portable-config.md` §运行时语义 3 +
commit `566745f` HOW 段；未验证 TLS cli.mjs 内部 `findTypescriptVersion`
的源码行号]。

TLS 6.0.0 的 peer dep `typescript: ^6.0.3`（即 `>=6.0.3 <7.0.0`）不满足
vp 默认 `typescript@7.0.2` [plan `lsp-revert-to-global.md` 根因段 + commit
`b146e50` WHY 段；未直接验证 TLS 6.0.0 package.json peer 字段]。
commit `b146e50` 用 `vp add -g typescript@6.0.3` 满足 peer；commit `566745f`
走 workspace 解析后此约束放松到「项目自带 5.9.3 即可」。

### 1.5 MCP 工具面与 fallback

`$omo:lsp` SKILL.md（行 Tools 节）列 7 个工具：`lsp.status` /
`lsp.diagnostics` / `lsp.goto_definition` / `lsp.find_references` /
`lsp.symbols` / `lsp.prepare_rename` / `lsp.rename`。使用前提：codex
harness 启动时挂载 `omo-lsp` MCP server。本会话 `list_mcp_resources`
返回空 → 所有 `lsp.*` 工具不可调用 [上一轮 + 本轮验证]。

fallback 路径：

| 想要的能力 | fallback |
|---|---|
| `lsp.status`（installed + source + extensions） | `bun ~/.codex/plugins/cache/sisyphuslabs/omo/4.19.4/skills/lsp-setup/scripts/detect-lsp.ts . --json` |
| `lsp.diagnostics` / `lsp.symbols` 真实 roundtrip | 手工 JSON-RPC 驱动 TLS（Content-Length framing），参 `/tmp/lsp-verify/roundtrip.js` |
| `verify-lsp.ts` | 在 omo worktree 中跑；本环境 SKIP exit 3 [上一轮验证] |

## 2. 三次方案演进

| # | Commit | 方案 | 机制 | 采纳 / 否决理由 |
|---|---|---|---|---|
| 1 | [`fe892fb`](#) | 项目本地 devDep | `pnpm add -D` 把 TLS / bash-ls / yaml-ls 与 typescript 装到同一 `.pnpm/` 共享依赖树 | **技术上工作**（手动 roundtrip 拿到 `Typescript version (bundled) 5.9.3`）。`b146e50` 否决它是用户偏好，不是技术失败（详见 §3.4）。 |
| 2 | [`b146e50`](#) | vp 全局 + hash 路径 | `vp add -g` 三 server + `vp add -g typescript@6.0.3` 满足 TLS peer；`.codex/lsp-client.json` typescript entry 加 `initialization.tsserver.path = <个人家目录>/.vite-plus/packages/typescript/<hash>/bin/tsserver` | 解决 vp smart-shim 隔离 server 与 typescript 的问题。但 hash 入库不可移植 + `vp rm/add` 换 hash 即坏，被 `566745f` 否决。 |
| 3 | [`566745f`](#) | 可移植最小形态 | `.codex/lsp-client.json` 三个 entry 缩为 `{"priority": 100}`，删 `command` 与 `initialization.tsserver.path`；依赖 omo initialize 恒带 workspaceFolders → TLS 走 workspace 解析命中项目 `typescript@5.9.3`（`node_modules/typescript -> .pnpm/typescript@5.9.3/node_modules/typescript` [本机 `ls -la` 验证]） | **当前状态**。Plan：`.omo/plans/lsp-client-portable-config.md`。 |

Plan 文件指针：

- `fe892fb` → `.omo/plans/lsp-project-local-setup.md`
- `b146e50` → `.omo/plans/lsp-revert-to-global.md`
- `566745f` → `.omo/plans/lsp-client-portable-config.md`

## 3. Plan 间冲突与被证伪声明清单

### 3.1 `lsp-project-local-setup.md` 「engine builtin command 自动解析走项目 node_modules/.bin/」—— 4.19.4 dist 证伪

**原文**（plan 决定段第 3 条）：

> engine 的 builtin `command` 自动解析会走项目 `node_modules/.bin/`，如果实际仍选全局，需在 user config 显式覆盖 `command`

**证伪**：

- omo 4.19.4 dist `cli.js` 行 3874-3876 强制 project-source entry 使用
  `builtin.command = ["typescript-language-server", "--stdio"]`，entry
  里写的 `command` 字段被忽略。
- engine 不"主动解析项目目录"——它用裸 bin 名走 PATH 查找（`isServerInstalled`
  在 `cli.js` 行 3977-4010）。
- 真正决定命中哪份二进制的是 PATH 顺序：`fe892fb` 时代 pnpm 把
  `node_modules/.bin` 加到 PATH 前段，devDep 装的 TLS 在那儿；`b146e50`
  时代 vp 把 `~/.vite-plus/bin` 放到前段，bin 名解析到 vp 全局版。
- 引擎层与"项目目录"无任何特殊关系，只是 PATH 查找。"自动解析走
  `node_modules/.bin/`"是 PATH 副作用，不是引擎特性。

**未来读者**：应把该声明解读为「devDep 装好后 PATH 顺序让 bin 名优先解析
到项目」，不要把它当作 engine 行为的契约。

### 3.2 `lsp-revert-to-global.md` 「workspaceRoot 四条路径全找不到 typescript」—— 假阴性

**原文**（plan 根因段）：

> TLS 的 `findTypescriptVersion()` 走 userSetting → workspaceRoot → fallback → bundled 四条路径全找不到 typescript

**假阴性根因**：当时手工 roundtrip 没在 initialize 里带 workspaceFolders，
TLS 的 workspaceRoot 解析因为没传工作区目录而无法命中，错误判定"项目类
型目录也找不到 typescript"。omo 真实运行时 initialize 恒带 workspaceFolders
[commit `566745f` HOW 段「复刻 initialize 形状（无 initializationOptions）
探针在本项目 PASS、无 typescript 工作区负对照 FAIL（报错即历史故障文
案）」+ 负对照：`/tmp/no-ts-workspace` 没有 `node_modules/typescript` 即
复现 `Could not find a valid TypeScript installation`，与 plan 记录的故障
文案一致]。

**未来读者**：手工探针做 TLS workspace 解析结论前，必须复刻 initialize
形状（含 workspaceFolders）。

### 3.3 `lsp-revert-to-global.md` Rejected 「让 TLS 走 workspaceRoot 内的 typescript（无法跨项目复用，违背全局意图）」—— 混淆两件事

**原文**（plan Rejected 段）：

> 让 TLS 走 workspaceRoot 内的 typescript（无法跨项目复用，违背全局意图）

**混淆**：

- 「**user-global fallback**」指 `~/.codex/lsp-client.json` 给所有 workspace
  设置一份 typescript 来源；这是 user 级，确实"无法跨项目复用"——但
  workspace 解析不是这一层。
- 「**project-config pin hash**」指 `.codex/lsp-client.json` typescript entry
  加 `initialization.tsserver.path` 指 vp hash；这是 project 级，确实有
  "被 git 跟踪污染其他克隆者"的问题——但 workspace 解析也不是这一层。
- 「**omo initialize 恒带 workspaceFolders → TLS 自动解析项目 typescript**」
  是 omo 自己的机制选择，与 user-global fallback / project-config pin hash
  都无关。"跨项目复用"特性反而更强：每个项目用自己的 devDep typescript，
  互不干扰，也不污染配置。

把"workspace 解析"与"全局兜底"绑成同一个 rejected 选项，会让未来读者误
以为 omo 的 workspace 解析也被否决了。事实是它被 `566745f` 重新采纳，且
是当前可移植配置的支点。

### 3.4 devDep 方案技术上本就工作——避免未来误读

`fe892fb` 本地 devDep 方案**没有技术 bug**：手动 roundtrip 拿到
`Typescript version (bundled) 5.9.3` [commit `fe892fb` HOW 段]；pnpm 把
TLS 与 typescript 装在同一棵 `.pnpm/` 依赖树下，二进制启动后能定位 TS
[plan `lsp-project-local-setup.md` 根因段解释了 vp smart-shim 隔离是 TLS
找不到 TS 的根因，pnpm 安装绕开了该隔离]。

`b146e50` 否决它是用户偏好："用户决定按 lsp-setup 全局推荐走"
[commit `b146e50` WHY 段]，不是技术失败。

对未来读者的影响：

- 不要把"必须走 vp 全局"读成"devDep 必然坏"——本仓库可随时回退到 devDep
  方案。
- `lsp-revert-to-global.md` 「反向操作（rollback to local devDep）」段已经
  给出回退路径：删 `~/.codex/lsp-client.json` 覆写 + `pnpm add -D` + 调
  整 project config。
- 当前 `566745f` 方案同时绕开了两个方案的痛点：既不引 devDep，又不需要
  pin 绝对路径，是「路径上的最优解」，不是否定 devDep 技术有效性的证据。

## 4. 坑清单

### 4.1 vp smart-shim 隔离 server 与 typescript

- **症状**：`typescript-language-server` 启动后报 `Could not find a valid
  TypeScript installation`，exit 1 无 stderr。
- **根因**：vp smart-shim 把每个 package 装到独立 hash 目录
  （`~/.vite-plus/packages/<name>/<hash>/lib/node_modules/<pkg>/`），TLS
  通过自身 `node_modules/typescript` 找不到 typescript
  [plan `lsp-project-local-setup.md` 根因段 + commit `fe892fb` WHY 段]。
- **解法**：(a) devDep 同依赖树（`fe892fb`）；(b) `initialization.tsserver.path`
  指 vp hash 路径（`b146e50`）；(c) 走 workspace 解析（`566745f`，当前方案）。
- **预防**：任何 LSP 改动后，必须对 TLS 做真实 roundtrip（`documentSymbol`
  或 `initialize` 返回 capabilities），不要凭"装了 vp 包就 OK"的心智模型
  跳过验证。

### 4.2 TLS 6.0.0 peer dep 与 vp 默认 typescript@7.0.2 不兼容

- **症状**：`vp add -g typescript-language-server` 后 vp 默认装
  `typescript@7.0.2`，不满足 TLS peer `^6.0.3`，运行时找不到合法 typescript。
- **根因**：TLS 6.0.0 package.json `peerDependencies.typescript = "^6.0.3"`
  [未验证 TLS 6.0.0 package.json 字段，仅引 plan `lsp-revert-to-global.md` 
  根因段]。
- **解法**：`vp add -g typescript@6.0.3` [commit `b146e50` HOW 段]。
- **预防**：vp 重装 typescript 时若升 major，重新核对 TLS peer 范围。当
  前 `566745f` 方案下，TLS 走项目 devDep 5.9.3 不走 vp 全局 typescript，
  此坑被绕过——但 vp 全局 `typescript@6.0.3` 仍作为非项目上下文 fallback
  保留 [commit `566745f` Plan footer]。

### 4.3 symlink hack（`/opt/homebrew/bin/` → `node_modules/.bin/`）—— 否决

- **症状**：用户为绕过 PATH 顺序手动建 symlink，让全局 TLS 调用命中项目内
  binary。
- **根因**：symlink 治标不治本；vp 升级 / 重装 typescript 即断
  [plan `lsp-project-local-setup.md` Rejected 段]。
- **解法**：`b146e50` 直接删除三个 symlink [commit `b146e50` WHAT 段]。
- **预防**：不要用 symlink 解决 LSP / PATH 顺序问题；要么改 PATH 顺序，
  要么改配置。

### 4.4 探针假阴性（手工 roundtrip 未带 workspaceFolders）

- **症状**：`b146e50` 手工探针错判"workspaceRoot 四条路径全找不到
  typescript"，导致后续决定走 pin hash 路径。
- **根因**：探针未在 initialize 里带 `workspaceFolders`，TLS 的
  workspaceRoot 解析因为没传工作区目录而无法命中。
- **解法**：`566745f` 探针"完全复刻 connection.ts 的 initialize 形状（含
  workspaceFolders，不含 initializationOptions）" [plan 
  `lsp-client-portable-config.md` §实证]。
- **预防**：任何 LSP 实证必须以 omo 真实发包形状（`rootUri + 
  workspaceFolders + initializationOptions`）为准；缺一项即不构成有效
  结论。

### 4.5 hash 路径入库（`tsserver.path` 含 vp install hash）

- **症状**：`.codex/lsp-client.json` 的
  `initialization.tsserver.path = <个人家目录>/.vite-plus/packages/
  typescript/c030a1df-…/bin/tsserver` 推上 GitHub；其他克隆者没有该路径
  → fresh clone 的 LSP 即坏。
- **根因**：`b146e50` 当时唯一可工作的方案是把 vp 装的 tsserver 绝对路径写
  入文件；忽略了"被 git 跟踪的配置必须可移植"的契约。
- **解法**：`566745f` 删除该字段，依赖 omo initialize 恒带 workspaceFolders
  让 workspace 解析命中项目 devDep [commit `566745f` WHY 段]。
- **预防**：被 git 跟踪的 `.codex/lsp-client.json` 永远不写绝对路径 /
  install hash / `~/.vite-plus/...` / `/Users/...` / `/opt/homebrew/...`
  [commit `566745f` Directive 段「禁止把 install hash / 机器本地绝对路径
  写回任何被跟踪文件」+ AGENTS.md §本项目反模式 LSP bullet]。

### 4.6 omo 版本语义漂移

- **症状**：传闻 "main config-loader 跳过无 extensions 的 entry" 与 4.19.4
  dist 行为（用 builtin 补齐 extensions）不一致 [未验证 main 分支源代码]。
- **根因**：omo 上游对 project-source entry 的合并语义可能在 4.19.4 之后
  改变 [未验证]。
- **解法**：当前 `.codex/lsp-client.json` 写成最小 `{"priority": 100}` 形
  态（extensions 走 builtin 补齐），即使 main 改成"entry 必须自带 
  extensions 才生效"，也只是少一次扩展覆盖的兜底，不会让 builtin id 完全
  失效 [未验证 main 实际语义]；更防御的写法是显式写 `extensions: [...]`
  （成本：每加一个 id 多复制一份扩展列表）。
- **预防**：omo 升级时跑一次 `detect-lsp.ts . --json` 看 builtin 补齐后
  的 `extensions` 是否仍是预期集合；或显式写 extensions 让配置对 omo 内
  部改动更不敏感。

### 4.7 verify-lsp.ts 在插件缓存环境 SKIP（exit 3）

- **症状**：`bun ~/.codex/plugins/cache/sisyphuslabs/omo/4.19.4/skills/
  lsp-setup/scripts/verify-lsp.ts <file>` 返回
  `SKIP: lsp-tools-mcp engine not found (looked for packages/lsp-tools-mcp/
  src/tools.ts). Run verify-lsp.ts inside the omo repo/worktree.`，exit 3。
- **根因**：omo 4.19.4 插件 cache 只发 `components/lsp/dist/cli.js`（CLI /
  MCP 入口 bundle），不发 `packages/lsp-tools-mcp/src/*` 源码；本环境无
  omo worktree [上一轮 + 本轮 `find` 验证]。
- **解法**：手工 JSON-RPC 驱动 TLS（`/tmp/lsp-verify/roundtrip.js`）——
  底层是同一份 `typescript-language-server` 二进制，效果等价。
- **预防**：在没有 MCP / 没有 omo 源的会话里，`detect-lsp.ts` 是有效
  「installed + config」双检查，`documentSymbol` 类手工探针是有效
  roundtrip 替代；两者合用足以替代 SKIP 状态的 verify-lsp.ts。

### 4.8 codex pane session 未挂载 lsp MCP

- **症状**：`list_mcp_resources` 返回空；`lsp.status` / `lsp.diagnostics` /
  `lsp.symbols` 工具调用报"unknown tool"。
- **根因**：当前 codex session 的 MCP 配置未启 omo-lsp MCP server；omo
  CLI 自己有 `omo-lsp mcp` 子命令 [本机 `node ~/.codex/.../cli.js --help`
  验证]，但需要 harness 启动时挂载才会出现在 `lsp.*` 工具里。
- **解法**：手工探针 + `detect-lsp.ts` 替代；或重启 Codex session 让
  harness 自动挂载。
- **预防**：在 IDE/agent 配置里确认 omo-lsp MCP 已 enabled；CI / 临时
  session 里不要假设 `lsp.*` 一定可用。

### 4.9 commit-audit trailer 枚举值必须英文

- **症状**：自定义 lore trailer 写 `Confidence: 高` 或 `Scope-risk: 窄`
  会被 `commit-audit.mjs` 行 144-148 拒收。
- **根因**：`tests/qa/commit-audit.mjs` 行 144 用 `/\bConfidence:\s*(low|
  medium|high)\b/i` 校验枚举；行 147 用 `/\bScope-risk:\s*(narrow|moderate|
  broad)\b/i` 校验。
- **解法**：枚举值固定用英文（`low` / `medium` / `high`；`narrow` / 
  `moderate` / `broad`）；其他 lore 字段（`Constraint` / `Rejected` / 
  `Directive` / `Tested` / `Not-tested` / `Plan`）的键名也用英文，值可以
  中文 [本仓库已确立的「中文正文 + 英文 trailer 键名」契约]。
- **预防**：写新 commit 前先 `grep` `commit-audit.mjs` 看当前枚举；不要
  靠记忆写。

## 5. 当前现状 SOP

### 5.1 加 LSP server

1. `vp add -g <server-name>`：让二进制出现在 `~/.vite-plus/bin/`，PATH
   自动优先解析。`which <server-name>` 验证。
2. 在 `.codex/lsp-client.json` 加 entry：只写 `priority`，**不要**写
   `command` / `initialization` / 任何机器本地路径。若要覆盖 extensions /
   priority / 初始化选项，可显式写。
3. 跑门禁：`pnpm vitest run` + `pnpm typecheck` + `pnpm lint` + 
   `pnpm build`（路由数不变）+ `node tests/qa/commit-audit.mjs --branch 
   main`。
4. LSP 实证：
   - 若有 lsp MCP：跑 `lsp.status` 看新 server `source=project installed=true`。
   - 若无 MCP：跑 `bun ~/.codex/plugins/cache/sisyphuslabs/omo/4.19.4/
     skills/lsp-setup/scripts/detect-lsp.ts . --json`；并对真实 .ts / 
     .sh / .yaml 文件跑手工 `documentSymbol` / `didOpen` roundtrip 确认 
     capabilities 返回正常。

### 5.2 删 LSP server

1. `vp rm -g <server-name>`：从 vp 全局 namespace 移除。
2. 从 `.codex/lsp-client.json` 移除对应 entry。
3. 同步 AGENTS.md §本项目反模式 / `.github/copilot-instructions.md` Hard
   rules 中提及该 server 的条款（若有）。
4. 跑同样的 5 层门禁。

### 5.3 vp 重装（rm + add）后要做什么

**对项目 LSP 配置无事可做。** 当前 `.codex/lsp-client.json` 不含 vp install
hash、不含绝对路径。vp 重装只影响 `~/.vite-plus/packages/<name>/<new-hash>/...`
内的目录布局；engine 通过 PATH 查找裸 bin 名（`cli.js` 行 3977），bin 名解
析到 `~/.vite-plus/bin/<name>`（vp shim 自身稳定的符号链接），不依赖任何
hash 路径。

唯一需要复核的是：vp 重装后 TLS 仍能找到 typescript。当前方案走 workspace
解析，路径不依赖 vp；vp 重装时唯一相关的是 vp 全局 `typescript@6.0.3`（满
足 TLS peer dep）是否还在——若 vp 重装时把 typescript 也升 major，需要重新
对照 TLS peer 范围（见 §4.2）。

### 5.4 per-machine override 怎么做

把 override 写到 `~/.codex/lsp-client.json`（不入库）：

- 路径：CLI 用 `$CODEX_HOME` 或默认 `~/.codex/`；omo dist 行 5769 写
  `userConfigPath: join(codexHome, "lsp-client.json")` [本机 `grep` 验证]。
- 格式：与项目文件相同；user 级允许自定义 `command` 与 `extensions`
  [`cli.js` 行 3895-3904 `createServerFromEntry` for source="user"]。
- 何时用：单台机器需要指向私有 tsserver 二进制，或要为某个语言试不同
  LSP 实现（如临时把 typescript 换成 `biome`），不想污染仓库其他克隆者。
- **不要做**：把 vp hash 路径、机器本地绝对路径、`/Users/...` 等写回任何
  **被跟踪的**配置——这是 `566745f` 后的硬契约。

---

## 附 A：探针与实证记录

| 探针 | 命令 / 路径 | 结果 | 来源 |
|---|---|---|---|
| `detect-lsp.ts` | `bun ~/.codex/plugins/cache/sisyphuslabs/omo/4.19.4/skills/lsp-setup/scripts/detect-lsp.ts . --json` | 三 server `installed=true`、配置指向 `.codex/lsp-client.json` | 上一轮验证 |
| 手工 TLS roundtrip | `node /tmp/lsp-verify/roundtrip.js`（Content-Length framing + initialize + didOpen + documentSymbol on `lib/game.ts`） | 16 符号返回、无 `Could not find` 致命 | 上一轮验证 |
| omo 合并语义模拟 | `node /tmp/lsp-verify/source-installed.js`（复刻 `cli.js:3870` 的 `createServerFromProjectEntry` + `isServerInstalled`） | 三 server `source=project installed=true` | 上一轮验证 |
| `verify-lsp.ts` SKIP | `bun ~/.codex/plugins/cache/sisyphuslabs/omo/4.19.4/skills/lsp-setup/scripts/verify-lsp.ts lib/game.ts` | `SKIP: lsp-tools-mcp engine not found`，exit 3 | 上一轮验证 |
| 负对照（不属本次 commit） | 手工探针同形状但 workspace = `/tmp/no-ts-workspace`（无 `node_modules/typescript`） | `Could not find a valid TypeScript installation` exit 1 | plan `lsp-client-portable-config.md` §实证段；本次只引用其结论文案，未重跑 |

## 附 B：相关 commit / plan 索引

- commit `566745f` — fix(lsp): 去除 .codex/lsp-client.json 的机器本地 tsserver hash 路径（当前状态）
- commit `b146e50` — chore(lsp): 改回 vp 全局安装，删除本地 devDep 与 /opt/homebrew symlink
- commit `fe892fb` — chore(lsp): 项目本地 devDependency 装 typescript/yaml/bash LSP
- plan `.omo/plans/lsp-client-portable-config.md` — `566745f` 的设计记录
- plan `.omo/plans/lsp-revert-to-global.md` — `b146e50` 的设计记录
- plan `.omo/plans/lsp-project-local-setup.md` — `fe892fb` 的设计记录
- AGENTS.md §本项目反模式 LSP bullet — 仓库契约
- `.github/copilot-instructions.md` Hard rules — Copilot 同步契约
