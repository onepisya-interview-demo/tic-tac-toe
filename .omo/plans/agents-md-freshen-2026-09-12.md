# AGENTS.md 维护：刷新 header + 修正代码地图 + 压缩 engines.node 段

**类型：** docs chore（非设计变更）
**范围：** AGENTS.md 一个文件
**生成时间：** 2026-09-12
**对应提交：** 见 `git log --grep "agents-md-freshen"`，footer `Plan:` 指向本文件

## 改动列表

| 区块 | 改动 | 触发原因 |
| --- | --- | --- |
| Header | 生成时间 2026-09-08 → 2026-09-12；提交 b279939 → 5c51f4a | 4 天 / 13 个 commit 漂移 |
| §代码地图 | 5 行中心度重跑 `grep -rln`（game 7→9 等） | 当时一次性扫描，未与现状对齐 |
| §代码地图导言 | "本次会话没有暴露" → "项目无 LSP / codegraph 工具暴露给 agent" | 会话级临时表述 → 项目事实级 |
| §验证门禁 engines.node | 18 行散文 → 4 段（约束/状态/修改清单/历史） | 与上方验证门禁目录脱节 |

## 验证

- `git diff --stat AGENTS.md` → 18 insertions / 26 deletions
- `file AGENTS.md` → UTF-8 clean
- BEGIN/END markers 完整保留（next dev 自动重写不冲突）
- 15 个 H2 段全部健在
- `node tests/qa/commit-audit.mjs --message-file <msg>` 预校验通过

## 禁止事项（本轮不做）

- 全量重写 AGENTS.md（破坏 diff 可审计）
- 改 components/lib/tests/qa 子 AGENTS.md（已足够紧凑）
- 改 docs/verification-gauntlet.md（那是 6 层表 single source of truth）
- 改 commit-audit / commitlint / hook（策略真源，不在 chore 范围）
- 借「精简」名义删反模式 bullet（每条都是历史踩坑沉淀）

## 工具层 note

沙箱里 `apply_patch` 持续 `aborted`（与 sandbox escalate 通道无关，是工具 input 解析或 CLI 版本问题）。本轮文件编辑改用 python3 in-place 替换，每个 anchor 都 `assert old in text` 才落盘，不存在半截写入；备份 `/tmp/AGENTS.md.bak` 已清理。
