# Brief: 忽略 ULW 运行状态

ULW 产生的 QA 证据、goal 状态和 ledger 属于本地执行痕迹，不应进入源码历史。
保留 `.omo/plans/` 与 tracked 的 brief；仅精确忽略运行产物，避免污染提交。
