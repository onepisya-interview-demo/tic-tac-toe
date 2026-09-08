# Brief: 仓库外壳升级（开源 + AI 友好）

仓库内功（commit 规范、AI 文档、测试栈、门禁）已 antfu 风格；外壳缺：法律、
README 门面、GitHub 集成。本轮在不动 lib/components/app/db/commitlint 的前提下
补齐 6 类外壳，每类 1 个原子 commit，便于 bisect。

## 落点（6 commit，按依赖序）

| commit | type(scope) | 文件范围 |
| --- | --- | --- |
| A1 | `chore(release)` | LICENSE / CODE_OF_CONDUCT.md / CONTRIBUTING.md / SECURITY.md |
| B1 | `docs(readme)` | README.md（badges/features/FAQ/license ref/funding/logo） |
| C1 | `ci(github)` | .github/workflows/ci.yml |
| C2 | `chore(github)` | .github/ISSUE_TEMPLATE/{bug,feature}.yml + PULL_REQUEST_TEMPLATE.md |
| C4 | `chore(deps)` | .github/dependabot.yml |
| E1 | `docs(agents)` | .github/copilot-instructions.md |

## 关键约束

- 不动 `lib/`、`app/`、`components/`、`db/`、`commitlint.config.cjs`、AGENTS.md
  的提交契约段。
- 不引入新 npm 依赖；Dependabot/Copilot/CI 都是 GitHub 原生。
- 单 commit PR 总大小 < 150 LOC + 5 个新文件；任意 commit 单独构建/测试为绿。
- 每个 commit 都带 `Plan: .omo/plans/repo-shell-upgrade.md` 页脚。
- A1/B1/C2/E1 是纯静态文件，跳过 `pnpm build` 与浏览器 QA。
- C1 跑 `act -j lint/typecheck/test/build` 干跑验证 workflow YAML 至少能被解析。

## 拒绝方案

- 不用 release-please / changesets：项目是 Vercel 部署的 Next.js app，不发包。
- 不用 Renovate：Dependabot GitHub native 优先，省一个 secrets。
- 不重写 ESLint / commitlint / 测试栈：都已 antfu 风格。
- 不在 README 放交互式 SVG logo，仅加纯 SVG 文件链接。
