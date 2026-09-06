# Next.js 项目 · Brief 意图

> 工作目录：`/private/tmp/ulw-demo`
> 项目代号：`tic-tac-toe`（井字棋）
> 起草时间：2026-09-06
> 落地时间：2026-09-07
> 状态：**READY**

---

## 优先级总览

| 优先级 | 要素 | 内容 |
| --- | --- | --- |
| P0 | 核心目标（一句话） | 给两个线下真人提供一个「同设备 pass-and-play」的井字棋 Web 小游戏，自动记录战绩。 |
| P0 | 关键约束（必须遵守的硬边界） | 详见下节（10 条硬约束）。 |
| P1 | 1-2 个具体使用场景 | 详见下节（首页 / 游戏 / 结算 三场景）。 |
| P2 | 非目标（明确不做的事） | 详见下节（5 条不做的事）。 |
| P3 | 审美/风格偏好 | 详见下节（Linear + Vercel 风的暗色系）。 |

---

## P0 · 核心目标（一句话）

> 用 **Next.js（React 技术栈）+ Zustand** 写一个井字棋小游戏。两人在同一台设备上轮流落子，棋局胜负与战绩自动落库。

---

## P0 · 关键约束（必须遵守的硬边界）

- **路由**：Next.js **App Router**（`app/` 目录，Server Component 为默认）
- **语言**：**TypeScript**（严格模式 `strict: true`）
- **样式**：**Tailwind CSS v4** + 少量 **CSS Modules**
- **UI 组件**：**不引入 UI 库**，全部手写
- **状态管理**：**Zustand**（单进程内），不引入其他客户端状态库
- **数据持久化**：**SQLite + Drizzle ORM**，记录战绩
- **部署目标**：**Vercel**
- **必须有的功能**：
  1. 3×3 棋盘 + 黑/白棋子 + 落子合法性检查
  2. 胜负检测（横/竖/对角 3 连 + 平局判定）
  3. **先手黑/白随机**（每局开始随机分配）
  4. 三屏切换：首页 → 游戏页 → 结算页 → 再来一局
  5. 轮到谁下棋的明确指示
  6. 战绩持久化（总场次 / X 胜 / O 胜 / 平局 / 当前连胜）
  7. 重置战绩按钮
- **不能引入的依赖**（避免与已选栈冲突或冗余）：
  - 其他客户端状态库（Jotai / Redux / Recoil / MobX）
  - 其他路由库（react-router / TanStack Router — App Router 已自带）
  - UI 组件库（MUI / shadcn / Ant Design / Chakra / Mantine）
  - 动画库（framer-motion / GSAP / react-spring）— 用 CSS transitions
  - 其他 ORM（Prisma / TypeORM / Sequelize）— 已有 Drizzle
  - 服务端数据层（TanStack Query / SWR / Apollo）— 无服务端数据
  - 表单库（react-hook-form / formik）— 表单极简或无
  - 任何付费组件库 / 服务
- **其他硬性规则**：
  - 静态资源用 `next/font` 加载 Geist / Inter，避免 FOUT
  - 交互组件显式标 `'use client'`
  - 顶层布局用 React Server Component
  - 用 `create-next-app` 初始化脚手架（TypeScript + Tailwind + App Router + ESLint）

---

## P1 · 1-2 个具体使用场景

- **场景 A · 首页（开始游戏）**
  - 谁：玩家甲打开 `/`
  - 看到：标题「井字棋」+ 战绩卡片（总场次 / X 胜 / O 胜 / 平局 / 当前连胜）+ 「开始游戏」按钮 + 「重置战绩」按钮
  - 操作：点击「开始游戏」→ 系统随机决定先手（黑/白）→ 进入 `/play`

- **场景 B · 游戏页（落子中）**
  - 谁：玩家甲 或 玩家乙（同一设备，轮流操作）
  - 看到：3×3 棋盘 + 顶部「轮到黑/白」的指示 + 「认输/重开」按钮
  - 操作：点击空格 → 落子 → 切换指示 → 检测胜负
  - 检测结果：胜出 → `/result`；平局 → `/result`；继续 → 留在 `/play`

- **场景 C · 结算页（游戏结束）**
  - 谁：刚分出胜负的玩家
  - 看到：胜利方 + 庆祝动画 + 「再来一局」+「返回首页」+「重置战绩」
  - 操作：
    - 「再来一局」→ 直接随机先手 → 回到 `/play`
    - 「返回首页」→ 战绩已写入，回 `/`

---

## P2 · 非目标（明确不做的事）

- 不做用户系统 / 登录 / 多账号 / 注册
- 不做实时联网 / WebSocket / 多人在线对战 — **这是两个真人同设备轮流玩**
- 不做 AI / 电脑对手 / minimax 算法 — 完全是两人手动落子
- 不做 i18n / 多语言 — 仅中文
- 不做移动端深度适配 — 桌面优先，移动端「能看、不优化」即可
- 不做 SEO 深度优化 — 基础 metadata 足够
- 不做音效 / 背景音乐
- 不做主题切换 / 白天模式 — 仅暗色一种

---

## P3 · 审美/风格偏好

- **整体调性**：克制的工程师感
  - 参考：[Linear](https://linear.app) + [Vercel](https://vercel.com) 官网
  - 偏暗，强调可读性与键盘友好
- **配色**：
  - 背景：`#0A0A0A` 系列（深色基底）
  - 强调色：`emerald-400`（单一强调色，不滥用）
  - 文本：浅灰白层级（`#FAFAFA` / `#A1A1AA`）
- **字体**（通过 `next/font` 加载）：
  - 标题：**Inter Display** 或 **Geist**
  - 正文：**Inter**
  - 代码（如有）：**JetBrains Mono**
- **必须**：
  - 清晰的 8px 网格
  - 圆角克制（最大 8px）
  - 微妙的过渡（≤ 150ms CSS transitions）
- **不要**：
  - Emoji 装饰
  - 装饰性插画 / 渐变背景
  - 重阴影 / 模糊光晕
  - 圆角超过 8px 的卡片
  - 居中堆叠的营销式文案

---

## 完成条件（实施期自检）

- [ ] `create-next-app` 初始化完成，TypeScript + Tailwind + App Router + ESLint 全开
- [ ] 依赖仅含：`next`、`react`、`zustand`、`drizzle-orm`、`better-sqlite3`、`tailwindcss`
- [ ] 三屏路由 `/`、`/play`、`/result` 可访问
- [ ] 棋盘落子、胜负检测、先手随机、重开、再来一局 全部跑通
- [ ] SQLite + Drizzle 战绩读写正常，刷新页面后战绩仍在
- [ ] 字体通过 `next/font` 加载（Geist / Inter），无 FOUT
- [ ] 仅暗色主题，无主题切换
- [ ] `npm run build` 通过；`npm run lint` 通过；至少有一个 e2e/手动验证（首页 → 游戏 → 结算 → 再来一局）
- [ ] 部署到 Vercel 后可访问（可选，需用户提供 token）
