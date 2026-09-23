# ulw-compound-asset-deposition-20260923

## 目标

把 2026-09-23「四案修复 + 交叉审 + REJECT 整改」波的复利经验从调度者私有记忆落为仓库资产，使任何拉取本仓库的协作者与未来会话直接受益（主公 decree：复利资产归仓库，不归个人记忆）。

## 范围

1. `docs/anti-patterns.md` 追加 **L1-30**：断言「死代码 / 死键」前未跨包装层核验类型词汇表（实证：'not-found' 键误删 REJECT）。
2. `tests/qa/AGENTS.md` 追加 **「时序敏感断言」** 约定：锚定动作时刻、双沿钉、结构化诊断、阈值须有推导依据（实证：step 02c 重锚波）。
3. `docs/dispatcher-playbook.md` 追加 **「多席并行与交叉审」** 节：worktree 隔离并行、双盲审假绿清单、REJECT 闭环、语言一致性惯例（实证：本日四席波）。

## 验收

- 三个文件各含对应新节 / 新条目，正文中文。
- 本次提交本身示范语言契约：subject 中文、`docs(...)` 前缀、WHAT/WHY/HOW + trailer + Plan footer，commit-audit 通过。

## 记录

语言一致性的机械门禁化（commit-audit 增语言规则）是候选票，是否立项待主公裁决；本次仅将惯例显式写入 playbook，不改门禁脚本。
