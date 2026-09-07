# Brief: 中文化层级 AGENTS 知识库

用户要求仓库的 AGENTS.md 使用中文。这次改动把根文件重排为项目知识库与中文贡献指南，并新增 components、lib、tests/qa 三个子目录说明，让代理入口按领域分层。

## Must

- Next 自动生成区块逐字保留，避免 next dev 再生成时冲突。
- Conventional 提交前缀、lore trailer 键名、命令和路径保持英文；说明性文字使用中文。
- 根文件保留提交契约、验证门禁、设计记录要求和 commit-msg hook 约束。
- 子文件只写领域特有入口、契约和反模式，不重复根文件。

## Tradeoffs

- 将原有英文贡献指南压缩为可执行的中文版本，移除外部仓库风格对照；规范细节仍由审计脚本和 commitlint 强制。
- 代码地图的引用中心度来自 import 扫描；当前工具面没有 LSP/codegraph，所以不声称精确引用计数。

## Rejected

- 翻译 Next 自动区块：next dev 会重新生成英文版本，产生循环噪声。
- 只翻译根文件：子目录说明会继续使用英文，无法满足中文代理入口目标。
