# Plan: ulw · 交接四件之对抗性复核（ulw-verify-handoff-20260914）

- 日期：2026-09-14
- ulw-loop：`.omo/ulw-loop/ulw-verify-handoff-20260914/`
- 授权：主公 2026-09-14 面谕「VERIFY: fresh-context adversarial verification，
  开 fresh 子代理（herdr tab 非分屏）复核，缺陷则修」

## 背景与既裁事项

本 session 已完四件（T1 Copilot 探针 / T2 社交卡 / T3 Discussions / T4 Stryker），
攒两 commit（ba19ce5 社交卡+计划档、575e212 变异基线），未 push。
调度者自查 ≠ 独立验证——须 fresh session 零上下文对抗复核，觅瑕于不疑处。

## 验证者（verifier）委任

- 载体：herdr tab（非 split pane），fresh session（codex 优先；
  codex 通道若陷宣言循环或不可用，按仓例 W1.x 降级 pi，再降调度者
  亲验并如实披露）
- 协议：接令先以己语复述任务与验收（teach-back），产出须附证据
  （命令+输出）；复用仓内既有契约不臆测

## 复核清单（对抗式，证伪优先）

V1 仓面实证：
  - git log -2 两 commit 存在、main=origin/main+N 未 push（禁我方 push）
  - 两 commit 触及文件仅 docs/social-card.png、docs/verification-gauntlet.md、
    .omo/plans/ulw-handoff-governance-20260914.md（禁区三目录零触、零新依赖、
    零 package.json/lock 改动）
  - 六门独立复跑：vitest 108 / typecheck / lint / build /
    commit-audit --branch main fail=0（抽查，不必全跑 build 可裁量）
V2 社交卡：
  - file 验 1280×640；目验三帧非碎图；色不违暗底契约
  - 卡内文字与仓实相符（仓名/徽章/一句话介 vs README）
V3 Stryker 基线：
  - reports/mutation/mutation.json 逐项复核文档数字（总/covered/四文件
    分数/killed/timeout/survived/no-cov/errors=7 且在 store.ts）
  - errors statusReason 是否确为 Test runner crashed（RuntimeError）
V4 GitHub 侧：
  - issue #9 状态 closed、含探针结论评论、assignees 空
  - discussion #10 存在、category=Announcements、正文含 v1.0.0 链与
    贡献三链；isPinned 现值如实（应为 false，pin 移交主公）
  - 仓 has_discussions=true
V5 台账一致性：
  - ulw-loop goals.json 四 goal status 与 ledger 证据互洽；
    plans 文件与入库版本一致
  - sessions.local.md 有无本 session 登记需求（收尾项，verifier 只记不写）

## 验收标准

- AC1: verifier 报告落 `.omo/ulw-loop/ulw-verify-handoff-20260914/report.md`，
  逐 V 项 PASS/FAIL 带证据；调度者独立抽查 ≥3 项交叉印证
- AC2: 发现 FAIL → 调度者判定修复方（可修则修，出 commit 遵契约；
  不可修则如实披露并移主公）
- AC3: 不 push；herdr tab 用毕即关；session id 录
  .omo/sessions.local.md（verifier 与调度者各录各的）

## 边界

- 复核只读为主；修复件须另立原子 commit，不与本批混
- codex 通道 apply_patch 不可用（勿调）；文件操作走 shell
- 不做禁区三件、不迎拒 Dependabot
