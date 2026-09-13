# 分支策略（Branching）

> 决策：2026-09-13 治理讨论定案。模型 = **Trunk-Based / GitHub Flow**，
> 无 `develop` / `release/*` / `hotfix/*` 长命枝。

## 模型

| 枝/标 | 长相 | 用途 |
| --- | --- | --- |
| `main` | 唯一长命干线 | 永保可发布；push 即 Vercel 生产部署 |
| `feat/*` `fix/*` `chore/*` | 短命，随用随开 | 欲 preview / 审查时开，squash 合入即删；Vercel 为每枝出 preview |
| `dependabot/*` | 自动 | 依赖升级，PR 进 main |
| `tag v*` | 快照（非枝） | 里程碑剪版（`v1.0.0` 起），GitHub Release 记录 |

## 为什么没有 dev 分支

`develop` 为 GitFlow 之场景而生：定时发版窗、多 feature 同悬集成、多队并行。
本仓三者皆无——单人开发、push 即部署、CI 五门护 main。多一支长命枝 =
**永久双账**（每功必合两次、双份 CI、双线漂移），是税不是简。

**以痛引枝，不预设枝**。以下任一成真时再议立 dev/release：

- 多个未完成 feature 需同时悬置、等一个共同发版窗
- 团队 >5 人、或需 main 常驻对外演示而日常工作须隔离
- 应用需多版本同养（如 v1.x 与 v2.x 并行维护）→ 届时立 `release/*`

## 双 Ruleset（GitHub 侧强制）

| Ruleset | 法条 | bypass |
| --- | --- | --- |
| `main-redline` | 禁删 main · 禁 force-push | **无**——纵 admin 亦须 UI 申报理由 |
| `main-gate` | PR + 1 approve + CODEOWNERS review + 五 CI 必绿 + 仅 squash 合入 | repository admin（独立开发直推直并留审计痕） |

协作者入门即被 main-gate 自动约束（无 bypass），**规则零改动**。

## 线性史

凡 PR 一律 squash 合入（`allowed_merge_methods: ["squash"]`），main 无
merge commit、史为一线：`git bisect` 每节点皆可构建态，revert 无 merge
回退锁。不设 linear_history 法条（Ruleset 无此条目），而以入口断绝之。

## 合入速查

```bash
# 小改（独立开发者，admin bypass）
git push origin main

# 大改 / 想看 preview
git switch -c feat/<slug> && git push -u origin feat/<slug>
# → PR → CI 五门绿 → Vercel preview 验 → squash merge → 删枝
```
