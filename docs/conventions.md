# Conventions

> 来源：AGENTS.md §约定（行 82–90）

## 项目约束（每会话必读，已在 AGENTS.md L0 内联，下面是展开版）

- 修改路由、handler、类型或生成文件前，先阅读 [AGENTS.md](../AGENTS.md) 中 Next.js 16 自动警告。
- Server Component 是默认；只有交互或浏览器 API 需要时才添加 'use client'。
- 路径别名 `@/*` 指向仓库根目录；规则放 `lib`，schema 放 `db`，UI 组合放 `components`。
- 设计令牌保存在 `app/globals.css` 和 `DESIGN.md`；Tailwind class 引用令牌。

## 提交与文档

- 提交主题和正文可以中文；Conventional 前缀与 lore trailer 键名保持英文。
- 路由命名遵循 W1 御定：`/online` (实时上服) + `/offline` (纯本地) + `/result` (RSC 成绩单)；不引入 `solo` / `ranked` / `singleplayer` / `multiplayer` 词汇（schema.org 词汇表对齐理由见 README「词汇语义说明」节）。
- 领域概念命名以 `CONTEXT.md` 为准：一切产出物（代码、commit 正文、plan、review、探针）使用表内术语、禁用其 `_Avoid_` 别名；概念不在表中勿造新词——先判断是否真缺口，是则按 `.omo/plans/glossary-context-md.md` D3 门槛入 Pending 区，复用后晋升。

## 库与依赖

- 不引入 UI、路由、动画、数据访问或表单库；这些是项目约束明确排除的。
- LSP 服务端工具（typescript / yaml / bash language server）走 vp 全局安装，禁止作为项目 npm 依赖。详见 [docs/anti-patterns.md §L2-1](./anti-patterns.md#l2-按需读--agents-md-完全外化)。

## 交叉引用

- 全部硬约束（漏读会破契约）→ [docs/anti-patterns.md §L0](./anti-patterns.md#l0-硬约束--漏则破契约)
- 命令清单与端口约定 → [docs/commands.md](./commands.md)
