# ulw · 全量 review + 消融实验 + 遗留待办（push 冻结）

- **日期**：2026-09-15
- **状态**：APPROVED（主公谕：$omo:review-work；全部 codex 执行；并行按上下文正交划分）
- **对象**：main 领先 origin/main 之 11 commit（bb171bf…f8fd69e，见 git log 51f164c..HEAD）
- **铁律**：push 冻结（合格亦须主公亲自 push）；合并必经 PR（GitHub main-gate 本制）；codex 编辑一律 shell（sed/python/heredoc/git apply），**禁 apply_patch**（通道已知缺陷）

## 1. 验收标准（机器可判）

| # | 项 | 判定 |
|---|-----|------|
| B1 | 四路 review 各出 findings 榜（严重度+文件:行号+修法），零 False-Positive 不追究、零漏报由消融兜底 | reports/review/RA-RD.md 存在且含判定 |
| B2 | 消融三轮全数落证：AB1 VT 消融回退全绿 / AB2 solo 零写探针对抗有效（人为注写须红）/ AB3 双闸各自必要（去 guard 注 stamp 须红，复 guard 绿） | reports/ablation/AB{1,2,3}.md 各含命令+尾行+判定 |
| B3 | social-card 四变体重制（1200×630 或对齐原图尺寸），app/layout.test.ts 仍绿，public/ 镜像同步 | `sips -g pixelWidth` + 测试尾行 |
| B4 | stats-race 双 launchQA 旧疵清除，14/14 仍绿 | 探针尾行 |
| B5 | review findings 之「修」级缺陷全部修复并复验（fix commit + 门禁绿） | git log + 门禁尾行 |
| B6 | push 计数不变：全程 `git push` 零调用 | `git status -sb` ahead 数只增于本地 commit |

## 2. 正交划分（文件面互斥）

**波 1 实录（R2）**：六路 codex 并行。通道疾二次（RA 噪启、RC/wart 工具 EOF），就席催发/新席重派后全竣：
- RA：7 账 0 修（internalStats 双语义、白名单、跨模式测缺、隐私测缺、mode 错配脆性）
- RB：0 修 6 账 2 疵（六对抗点全 PASS）
- RC：0 修 2 账（实测 21min：guide 逐条/降级矩阵/emulateMedia/受害面扫描全 PASS；stats-race fetch 偶发 race 账）
- RD：1 修（双 launchQA 泄漏）+ 2 账
- W-abl：AB1 绿（VT 摘除安全）/ AB2 红（零写探针抓注写回归）/ AB3 矩阵（双闸各自必要）——三防线实证 ✓ commit b4fd9f2
- wart2：social-card 四变体重制 1280×640 对齐旧尺寸，五门禁绿 ✓ commit 9e2d2b8

**波 2 实录**：FX1（stats-race 三修：双 launchQA 合并/DELETE 显式超时/fetch 重试）∥ FX2（solo 契约五加固：白名单/resetSoloStats 守卫/PlayController mode 错配重置/跨模式两用例/隐私用例，含反向自证）并行。

**波 2 · 修复（按 findings 文件面分组派 fresh codex；与波 1 产出互斥则可并行）**
**波 3 · 终验（fresh codex 对抗复核 + 全门禁 + 探针全量）**

## 3. 编排

- 全程 herdr tab；等待遵守 docs/herdr-session-hygiene.md v2.1：估 T÷5 分片、候 done 不候 idle。
- review/消融 lane 的门禁：不涉产品码不跑 build；W-art/W-abl 各自跑所涉门禁。
- 消融 worktree 用毕即 `git worktree remove`；server 用毕必杀。
- findings 分级：**修**（本轮必修）/ **账**（记档下轮）/ **疵**（不碍判定注记）。

## 4. 遗留待办映射

| 原待办 | 本计划落点 |
|--------|-----------|
| social-card 重绘 | W-art |
| stats-race 双 launchQA | RD 提出修法 → 波 2 修复 |
| push | 冻结；B6 守护；主公亲手 + PR 后方可合并 |
