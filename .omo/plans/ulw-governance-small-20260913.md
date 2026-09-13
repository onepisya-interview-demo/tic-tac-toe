# Plan: ulw · 治理小件二则（ulw-governance-small-20260913）

- 日期：2026-09-13
- ulw-loop：`.omo/ulw-loop/ulw-governance-small-20260913/`

## 背景与既裁事项

主公四问既答：E 定 `* @onepisya`；F 明 Sponsors 未开通。
本 plan 覆盖两枚原子 commit：

1. **CODEOWNERS**：新增 `.github/CODEOWNERS`，单行 `* @onepisya`。
   账号已验存在（gh api users/onepisya → onepisYa, User）。
   注：@onepisya 须有本仓写权限方自动收 review request；现为占位契约，
   分支保护启用后生效。
2. **README Funding 节移除**：该节链接指泛域 github.com/sponsors，
   主公 Sponsors 未开通，链接为死重——整节删之（L235-238），余文不动。

## 验收标准

- AC1: `.github/CODEOWNERS` 内容恰 `* @onepisya`
- AC2: README 无 Funding 节、无 github.com/sponsors 残链
- AC3: 六门绿
- AC4: 两枚原子 commit，subject 小写，trailer 全，消息=授权件
- AC5: 不 push

## 边界

- 不动分支保护/Releases（C/D 讨论中）
- 两 commit 不混装
