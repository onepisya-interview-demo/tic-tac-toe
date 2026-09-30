---
title: Open-source readiness plan — ulw-demo
slug: open-source-readiness
status: implemented（M1-M5 于 2026-09-09 当日落地：f62238c/1934f8e/d76745a/c36c49c/ba37a61；状态线 2026-09-26 按 git 实况修正）
created: 2026-09-09
authors: onepisYa
references:
  - antfu (eslint-config-antfu, slidev, others) — conventions baseline
  - sindresorhus (chalk, execa, yoctocolors) — conventions baseline
  - AGENTS.md — local commit / verification contract
  - .github/copilot-instructions.md — AI tooling bridge
---

# 上线与开源前补齐计划

## 0. TL;DR

仓库**条件性开源就绪**：meta 文件（LICENSE / CoC / SECURITY / CONTRIBUTING / issue 与 PR 模板）与 CI 都齐了，但 npm 元数据、`private` 字段、release 工具链、代码托管侧设置、品牌/演示资产这三块有缺口。**整体离 antfu / sindresorhus 标准还差一个下午到一个工作日的工作量。**

后续实施以本计划 footer `Plan: .omo/plans/open-source-readiness.md` 引用，每个动作按 AGENTS.md「原子提交」规范走一个 commit。

---

## 1. 现状摸底（evidence）

来源全部为本地 `ls` / `rg` / `git` / `curl <raw.githubusercontent.com>` 直接落到的文件:行或字节数；不复述记忆。

### 1.1 仓库门面（top-level）

| 文件 | 状态 | 字节 |
| --- | --- | --- |
| `README.md` | ✓ | 9 574 |
| `LICENSE` | ✓ | 1 065 |
| `CONTRIBUTING.md` | ✓ | 1 962 |
| `CODE_OF_CONDUCT.md` | ✓ | 8 690（Contributor Covenant 3.0） |
| `SECURITY.md` | ✓ | 1 678 |
| `AGENTS.md` | ✓ | 8 358（AI 代理契约，已是项目亮点） |
| `DESIGN.md` | ✓ | 6 866 |
| `CHANGELOG.md` | ✗ | — |
| `.editorconfig` | ✗ | — |
| `.nvmrc` | ✗ | — |
| `.node-version` | ✗ | — |
| `.npmrc` | ✗ | — |
| `.dockerignore` | ✗ | — |

### 1.2 `.github/`

| 文件 | 状态 |
| --- | --- |
| `dependabot.yml` | ✓（github-actions + npm 周更） |
| `workflows/ci.yml` | ✓（lint/typecheck/test/build/visual-qa） |
| `ISSUE_TEMPLATE/bug_report.yml` | ✓ |
| `ISSUE_TEMPLATE/feature_request.yml` | ✓ |
| `ISSUE_TEMPLATE/question.yml` | ✗（路由到 Discussions） |
| `PULL_REQUEST_TEMPLATE.md` | ✓ |
| `copilot-instructions.md` | ✓ |
| `CODEOWNERS` | ✗ |
| `FUNDING.yml` | ✗ |
| `release.yml` | ✗ |
| `settings.yml`（sindresorhus 同款 repo 治理） | ✗ |

### 1.3 `package.json` 元数据

```text
name: "tic-tac-toe"               ← 与 npm 上同名包冲突（见 §3 M5）
version: "0.1.0"
private: true                     ← 翻转必须
description: undefined
author: undefined
license: undefined                ← LICENSE 文件存在，但字段缺失
homepage: undefined
repository: undefined
bugs: undefined
funding: undefined
keywords: undefined
engines: undefined                ← 推荐补 engines.node / engines.pnpm
type: undefined
packageManager: "pnpm@10.10.0"
```

### 1.4 Git 状态

- 分支：仅 `main`，无保护规则（GitHub 侧尚未启用）
- 远端：**无**（`git remote -v` 为空）
- Tags：3 个均为 `archive/...`，**无 release tag**

### 1.5 文档与品牌

- `docs/`：operations / testing / local-turso-setup / learnings — 已经是 antfu 级「单独 docs/」骨架
- `public/logo.svg`：自定义 SVG，✓
- `public/{next.svg, vercel.svg, file.svg, globe.svg, window.svg}`：Next.js 默认占位（建议清理）
- README 无居中 logo banner、无截图 / GIF / 演示视频
- 仓库无 og-image / social preview

### 1.6 CI

`.github/workflows/ci.yml` 已覆盖：lint → typecheck → test → build → visual-qa (Playwright)。缺：

- OS 矩阵（目前仅 `ubuntu-latest`）
- Node 矩阵（目前仅 `22`）
- coverage 阈值门禁（阈值在 `vitest.config.ts` 有，CI 没卡）
- commit-msg / commit-audit 没有入 PR check

### 1.7 标杆公约（curl 实证）

- **sindresorhus/chalk** `readme.md`：居中 logo → tagline → badges（coverage、dependents、downloads）→ screenshot → Info / Highlights / Install 经典结构。
- **sindresorhus** license 头：`Copyright (c) <name> <email> (<url>)`，**带作者主页 URL**——本仓库 LICENSE 是 `Copyright (c) 2026 onepisYa`，缺 email 与 url。
- **antfu** 一贯：emoji H1 + 技术栈 badges + Install + Usage + Sponsors + License，release 用 changesets。

---

## 2. Gap 表（三档）

> **MUST**：不做不能开源 / 推上 GitHub 公网
> **SHOULD**：上线一周内必补，影响首印象与可持续性
> **NICE**：上线后慢慢补，不阻塞

### M（MUST）

| ID | 项目 | 现状 | 行动 | 验证 |
| --- | --- | --- | --- | --- |
| M1 | `package.json` 翻转 `private` | `true` | 改 `false` 或删除字段 | `npm pkg get private` → `false` |
| M2 | 包元数据补齐 | 见 §1.3 多数 undefined | 补 `description` / `author` / `license: "MIT"` / `repository: { type: "git", url: "..." }` / `homepage` / `bugs.url` / `keywords` / `engines.node: ">=20"` / `engines.pnpm: ">=10"` | `npm pkg get description author license repository homepage bugs keywords engines` 全部非空 |
| M3 | `.editorconfig` | 缺失 | 新建：UTF-8、LF、trim_trailing_whitespace、insert_final_newline、2 空格、TS/JSON/YAML/MD 各自细则 | 文件含 `root = true` |
| M4 | `.nvmrc` | 缺失 | `20`（与 CI Node 22 兼容性：CI 用 22，本地用 20 即可；如想和 CI 一致写 `22`） | `cat .nvmrc` → `20` 或 `22` |
| M5 | npm 包名冲突 | `tic-tac-toe` 在 npm 已被占用 | 决定是否要 publish 到 npm；如要，改 `@onepisya/tic-tac-toe`；如不要（仅 GitHub 开源），保持 + 在 README 写明「源码不在 npm 发布」 | `npm view tic-tac-toe name` 看占用方 |
| M6 | git remote | 空 | 创建 GitHub 仓库，加 `git@github.com:onepisya/tic-tac-toe.git` 远端，push main | `git remote -v` 显示 origin；`git ls-remote --heads origin` 返回 main |
| M7 | GitHub 仓库侧设置 | 尚未创建 | 启用：Description、Homepage、Topics（`tic-tac-toe` `nextjs` `react` `zustand` `drizzle` `libsql` `tailwindcss` `typescript` `playwright`）、Releases、Discussions、Sponsorship | `gh repo view <name> --json description,homepage,repositoryTopics` 返回非空 |
| M8 | branch protection on `main` | 缺 | GitHub Settings → Branches → main rule：要求 CI（lint/typecheck/test/build/visual-qa）+ 1 review + linear history + 不允许 force push | `gh api repos/<owner>/<repo>/branches/main/protection` 返回 `required_status_checks.enabled = true` |
| M9 | `.github/CODEOWNERS` | 缺 | `*       @onepisya` | `gh api repos/<owner>/<repo>/contents/.github/CODEOWNERS` 200 |
| M10 | `SECURITY.md` 邮箱强化 | 邮箱裸写在文件里 | 建议保留邮箱（这是 sindresorhus 同款做法），但显式说「PGP on request」 | 现有 `SECURITY.md` 已含此条，**只需确认** |
| M11 | PR check：commit-audit | CI 没跑 | `.github/workflows/ci.yml` 增加 `commit-audit` job，或在 PR check 中跑 `node tests/qa/commit-audit.mjs --message-file <last-commit-msg>` | 故意写一条不合规 commit 触发红，CI 红 |
| M12 | 仓库默认设置：Wikis / Issues 启用 | 默认已开 | 确认 Discussions 类别（Announcements / General / Ideas / Q&A / Show and tell）已建 | GitHub UI 截图 |

### S（SHOULD）

| ID | 项目 | 行动 | 验证 |
| --- | --- | --- | --- |
| S1 | README 顶部 logo + tagline + 一张截图 / 短 GIF | 跑 `pnpm build && pnpm start`，`pnpm exec node tests/qa/visual-qa.mjs` 拿首屏 PNG；用 ffmpeg 录 8 秒 GIF；README 居中插入 `media/screenshot.png` + `media/demo.gif` | README diff 显示图片块；`file media/screenshot.png` 报 `PNG image` |
| S2 | og-image | 用 logo + tagline 生成 1280×640 PNG，落到 `public/og.png`，README 头部加 `<meta property="og:image" content="/og.png">`（在 `app/layout.tsx` 的 metadata 里） | `curl -I http://localhost:3000/og.png` 返回 200 + `image/png` |
| S3 | release 工具选型 | 三个选项：① Changesets（antfu 同款）② release-please（Google 同款）③ 手工 `npm version` + `CHANGELOG.md`（最小）；**推荐 ① changesets** | `.changeset/config.json` 存在；`pnpm changeset` 可交互运行 |
| S4 | 第一次正式打 tag `v0.1.0` | 在 changesets 跑 `pnpm changeset version` 后 `pnpm tag` 触发 release workflow | `git tag --list 'v*'` 非空；`gh release list` 返回 v0.1.0 |
| S5 | CI OS 矩阵 | `runs-on: ubuntu-latest, macos-latest`（先两矩阵，避免一开始就 3 个 OS） | 故意改 `lib/game.ts` 引入 Node 22-only API，PR 看 macos job 也跑 |
| S6 | CI Node 矩阵 | 20 / 22 双跑 | 同上 |
| S7 | coverage 门禁 | 在 `test` job 末尾加 `pnpm vitest run --coverage --coverage.thresholds.lines=80 ...`；或挂 codecov | 故意把 lib 删一行让 lines 跌破 80%，CI 红 |
| S8 | 清理 `public/` 默认 SVG | 删 `next.svg` `vercel.svg` `file.svg` `globe.svg` `window.svg`，只留 `logo.svg` + `favicon.ico`（如有） | `git ls-files public/` 仅显示 `logo.svg` `favicon.ico` |
| S9 | `.github/ISSUE_TEMPLATE/question.yml` | 加一条，body 引导到 Discussions | 故意开 issue 选 Question 模板，能渲染 |
| S10 | `.github/FUNDING.yml` | `github: onepisya` | `gh api repos/<owner>/<repo>/contents/.github/FUNDING.yml` 200 |
| S11 | `.github/release.yml`（GitHub 侧） | categories + 自动 changelog 从 PR labels 拼 | `gh release create --draft` 触发看分类生效 |
| S12 | LICENSE 头加 email + URL | 改 `Copyright (c) 2026 onepisYa <email> (<homepage url>)` | `head -3 LICENSE` 显示新格式 |
| S13 | `docs/architecture.md` | 把 AGENTS.md「代码地图」提一档出一图（`game` ↔ `store` ↔ `/api/stats` ↔ `db`） | 新文件存在；README 文档导航加一行 |
| S14 | dependabot cooldown | `.github/dependabot.yml` 加 `cooldown` 字段（每周一 PR 风暴问题） | dependabot 周一不发新 PR 直到合并 |

### N（NICE）

| ID | 项目 |
| --- | --- |
| N1 | README 末尾加 "Used by" / "Showcase"（出现 dependents 后填） |
| N2 | GitHub social preview（Settings → Social preview） |
| N3 | 把 FAQ 从 README 拆出到 `docs/FAQ.md`，README 留短链 |
| N4 | 加 npm version / downloads / codecov / contributors badges |
| N5 | 把 `next.svg` 任何借用 Vercel 品牌的视觉移除 |
| N6 | `docs/security-model.md`（@libsql/client + Turso token 流转图） |
| N7 | 在 Vercel 部署 production demo，README 钉 URL |

---

## 3. 实施顺序（一个下午到一天）

每一步 = 一个原子 commit + 验证。CI 全绿后再进下一步。

```
T0: M1 + M2 + M3 + M4 + M5（包元数据 + 协议文件）       ─ 30 min
T1: M6 + M7 + M8 + M9（建远端 + 仓库设置 + 分支保护）  ─ 30 min
T2: S8（清理 public/）                                   ─ 15 min
T3: S1 + S2（README logo + 截图 + og-image）             ─ 45 min（依赖 visual-qa）
T4: S3 + S4（changesets + v0.1.0）                        ─ 60 min
T5: S5 + S6 + S7（CI 矩阵 + coverage 门禁）               ─ 45 min
T6: M11（commit-audit 入 PR check）                       ─ 20 min
T7: S10 + S11 + S12 + S13 + S14                          ─ 60 min
T8: 收尾：v0.1.0 release notes + 触发 release workflow   ─ 30 min
```

---

## 4. 验证总览

每条都对应一个最小可行证据（CI / CLI / GitHub API）：

- **协议 + 模板完整性**：
  ```
  git ls-files | grep -E '^(\.github|LICENSE|CONTRIBUTING|CODE_OF_CONDUCT|SECURITY|\.editorconfig|\.nvmrc|\.npmrc|\.dockerignore|\.github/CODEOWNERS)'
  ```
  应全部存在。
- **包元数据**：
  ```
  npm pkg get private description author license repository homepage bugs keywords engines
  ```
  全部非空。
- **CI 矩阵**：故意触发一个 OS / Node 维度失败，看对应 axis 红。
- **截图**：跑 visual-qa，PNG 落到 `tests/qa/.evidence/` 或 `.lavish/visual-qa-evidence/`。
- **协议 link 完整性**：`rg -n '\]\(' README.md CONTRIBUTING.md SECURITY.md CODE_OF_CONDUCT.md` 抽样人工校验。
- **tag**：故意 `git tag v0.0.0-test && git push origin v0.0.0-test --delete` 试 release workflow 是否被 trigger，再正式 `v0.1.0`。

---

## 5. 风险与回滚

- 任一 MUST 失败 → 开源动作挂起；CI 红也挂起。
- SHOULD 项可以分批发车，每次发车后看 GitHub 邮件 / issue 反馈再调。
- NICE 项永远不阻塞发车。
- 回滚：每个 commit 原子，`git revert <sha>` 或 `git reset --hard <last-good-sha>`（按需）。

---

## 6. 已知 anti-pattern（与本计划对齐）

AGENTS.md「本项目反模式」已经规定「不要 emoji 图标、不要 inline hex」。本计划中：

- S1 / S8 涉及视觉替换，需走设计令牌，不破坏 DESIGN.md。
- M2 涉及添加 npm 关键词；不会引入新依赖（项目硬约束）。
- M11 涉及把 commit-audit 入 PR check；不绕过 `--no-verify`。

---

## 7. 计划 footer

按 AGENTS.md「设计记录」要求，本文件作为后续实现 commit 的 Plan 引用对象。**实现 commit** 在 footer 加 `Plan: .omo/plans/open-source-readiness.md`，并按「类型 + WHY/HOW + lore trailers」规范写。

Plan: .omo/plans/open-source-readiness.md
