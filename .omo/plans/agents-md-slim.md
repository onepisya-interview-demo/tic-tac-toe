# Plan: AGENTS.md 瘦身为 Router 形态（218 → ≤150 行）

## 意图

AGENTS.md 从「全文契约」瘦身为「Router + digest」：根文件只保留最小路由、每-commit
必跑门禁和反模式等高频契约，细节迁入 docs/ 独立文档，agent 按需读取。

## 调研依据（外部证据）

1. 2500+ 仓库研究：AGENTS.md >150 行收益递减、推理成本 +20-23%
   （betterclaw.io/blog/agents-md-best-practices）。
2. Router 模式：Root = Minimal routing, not detailed content；细节放独立文档 + 简述
   （sergiusavva ai-context-docs-lifecycle；philschmid.de/writing-good-agents）。
3. Garry Tan gstack 的 digest 模式：AGENTS.md 只放 1.7KB digest（Ethos / 复用阶梯 /
   Voice / 指针），完整内容在工具文件
   （github.com/garrytan/gstack agents-digest/gstack-AGENTS.md）。

## 决策

1. **docs/verification-gauntlet.md 是验证门禁 single source of truth**（其自述即如此），
   AGENTS.md §验证门禁只留「每 commit 必跑六层」一行式清单 + 指针，禁止搬运大表。
   engines.node 三环境对齐细节从 AGENTS.md 迁入该文 Gap #5（同一真源文档，避免开第二个家）。
2. **提交策略细节归 docs/commit-policy.md**（新建）：五步流程、正文 schema、lore trailers、
   中文默认 + 三例外、原子提交、设计记录、PR 大小、commit-msg hook 机制。策略执行真源仍是
   tests/qa/commit-audit.mjs（audit 脚本 = 策略真源，文档只做解释）。
3. **herdr session 协议细节归 docs/herdr-session-hygiene.md**（新建），源素材
   .omo/plans/herdr-session-hygiene.md（决策/实证/否决项）保持原位不动。
4. **§commit-msg hook 小节保留在 AGENTS.md**（约 4 行）：反模式 bullet 的契约三源明确引用
   「本文件 §commit-msg hook」，删除会产生悬空契约引用。
5. **新增 §调度者 digest**：角色一句话 + teach-back 委派协议一行 + 完整模板指针
   （.omo/plans/dispatcher-roles-retrospective.md §4，本 commit 前的 HEAD 即 d9acf4c）。
6. Header 提交指针 d046cc5 → d9acf4c（本改造前 HEAD）。

## 迁移映射

| AGENTS.md 原节 | 行数 | 去向 |
| --- | --- | --- |
| §提交约定（两类提交/五步/schema/中文三例外） | 34 | docs/commit-policy.md；AGENTS.md 留 8 行内 digest |
| §原子提交 / §设计记录 / §Pull Request 大小 | ~12 | docs/commit-policy.md；AGENTS.md digest 内一行指针 |
| §commit-msg hook | 4 | **保留原位**（反模式契约三源引用，见决策 4）；机制解释同步入 commit-policy.md |
| §验证门禁（6 层大表 + on-demand + engines.node） | 40 | 大表/on-demand：docs/verification-gauntlet.md（已有）；engines.node：迁入该文 Gap #5；AGENTS.md 留 6 行 digest |
| §herdr 多代理 session 卫生 | 10 | docs/herdr-session-hygiene.md；AGENTS.md 留 3 行 digest |
| （新增）调度者 | 0 | AGENTS.md 新增 4 行 digest；模板在 dispatcher-roles-retrospective.md §4 |
| nextjs 块 / 概览 / 结构 / 查找入口 / 代码地图 / 约定 / 反模式 / 风格 / 命令 / 备注 | ~120 | **保留不动**（反模式节名是 copilot-instructions.md 引用契约） |

## 否决项

- **否决：engines.node 段整体删除**——三环境对齐是会再次踩坑的契约（Vercel build cache
  失效、CI 漂移、vitest fork pool 退化），删了只能靠 git 考古找回。
- **否决：为瘦身改「本项目反模式」节名**——copilot-instructions.md 按节名引用，改名即断链。
- **否决：把 commit-audit 规则全文搬进 docs/commit-policy.md**——audit 脚本是策略真源，
  文档复述规则会产生第二个会漂移的副本；文档只解释策略 + 给三检查点指针。
- **否决：AGENTS.md 里保留 on-demand 三层的大表**——docs/verification-gauntlet.md 已有
  全表且自述 single source of truth，双份必漂移。

## 验收标准

1. `wc -l AGENTS.md` ≤ 150。
2. `grep '^## 本项目反模式' AGENTS.md` 命中。
3. nextjs 自动生成块原样保留（BEGIN/END 注释对完好）。
4. docs/commit-policy.md、docs/herdr-session-hygiene.md、本设计记录存在。
5. `pnpm vitest run` / `typecheck` / `lint` / `build` 全绿；
   `node tests/qa/commit-audit.mjs --branch main` 0 violations。
6. 单个原子提交 docs(agents-md)，全套 lore trailer + Plan: footer，无 --no-verify。

## 修订（首次提交被 hook 拒签后）

任务指定的 subject 含全大写 token `AGENTS`，触发 commitlint `subject-case`（never
upper-case，对全大写词敏感）；同时 trailer 单行超 100 字符触发 `footer-max-line-length`。
两者均由 commit-msg hook 拒签（audit 内部也跑 commitlint），不可绕过。调整：subject 改为
「代理规则文件瘦身为 Router 形态」（语义不变，避开全大写词），全部 footer 行硬限制
≤100 字符。提交前用 commitlint + audit --message-file 双通道预检。

## 提交

docs(agents-md): 代理规则文件瘦身为 Router 形态（单个原子提交）。
