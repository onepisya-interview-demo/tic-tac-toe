# 分支策略（Branching）

> 决策：2026-09-13 治理讨论定案 **Trunk-Based / GitHub Flow**——`main` 唯一
> 发布干线，无 `release/*` / `hotfix/*` 长命枝。2026-10-04 主公批 D21a 追认
> 既有实践：`dev` 常驻工作枝现役，发版走 dev→main PR（main-gate 全程约束：
> PR + 审批 + CI 必绿 + 仅 squash），辅 `dev-stable-*` 本地里程碑 tag。

## 模型

| 枝/标 | 长相 | 用途 |
| --- | --- | --- |
| `main` | 唯一长命干线 | 永保可发布；push 即 Vercel 生产部署 |
| `dev` | 常驻工作枝 | 日常集成主线；攒至节点经发版 PR 入 main（先例 PR #18） |
| `feat/*` `fix/*` `chore/*` | 短命，随用随开 | 欲 preview / 审查时开，squash 合入即删；Vercel 为每枝出 preview |
| `dependabot/*` | 自动 | 依赖升级，PR 进 main |
| `tag dev-stable-*` | 快照（非枝，仅本地） | dev 里程碑留痕（现役三枚：20260922 / 20260923 / 20260930，不推送） |
| `tag v*` | 快照（非枝） | 里程碑剪版（`v1.0.0` 起），GitHub Release 记录 |

## dev 常驻工作枝，非 GitFlow develop

`develop` 为 GitFlow 之场景而生：定时发版窗、多 feature 同悬集成、多队并行。
本仓 `dev` 不担此职——单人开发、无定时发版窗，只是常驻工作面：日常功成即推
dev，攒到节点经发版 PR 一次入 main。CI 仅 PR 触发（`ci.yml` 只挂
`pull_request: [main]`），推 dev 不烧 CI，无 GitFlow 双份 CI 之税；
`release/*` / `hotfix/*` 仍无必要。**以痛引枝，不预设枝**。以下任一成真时
再议升级：

- 多个未完成 feature 需同时悬置、等一个共同发版窗
- 团队 >5 人、或需 main 常驻对外演示而日常工作须隔离
- 应用需多版本同养（如 v1.x 与 v2.x 并行维护）→ 届时立 `release/*`

## 双 Ruleset（GitHub 侧强制）

| Ruleset | 法条 | bypass |
| --- | --- | --- |
| `main-redline` | 禁删 main · 禁 force-push | **无**——纵 admin 亦须 UI 申报理由 |
| `main-gate` | PR + 1 approve + CODEOWNERS review + 五 CI 必绿 + 仅 squash 合入 | repository admin——**单人 approve 死锁逃生门**（独立开发直推直并留审计痕，先例 PR #17） |

协作者入门即被 main-gate 自动约束（无 bypass），**规则零改动**。

## 线性史

凡 PR 一律 squash 合入（`allowed_merge_methods: ["squash"]`），main 无
merge commit、史为一线：`git bisect` 每节点皆可构建态，revert 无 merge
回退锁。不设 linear_history 法条（Ruleset 无此条目），而以入口断绝之。

## 合入速查

```bash
# 日常（dev 常驻工作枝）：功成即推
git push origin dev

# 节点留痕（本地里程碑 tag，不推送）
git tag dev-stable-<yyyymmdd>

# 发版（dev → main）：PR 过 main-gate——审批 + CI 必绿 + 仅 squash 合入
# → squash merge → Vercel 生产部署（先例 PR #18）

# 逃生门：单人 approve 死锁时 admin 直推直并留审计痕（先例 PR #17）
git push origin main

# 大改 / 想看 preview
git switch -c feat/<slug> && git push -u origin feat/<slug>
# → PR → CI 五门绿 → Vercel preview 验 → squash merge → 删枝
```
