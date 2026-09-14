# Plan: ulw-meta-extras-20260914 · Twitter card 元扩展（A+B+C）

- 日期：2026-09-14
- ulw-loop：`.omo/ulw-loop/ulw-meta-extras-20260914/`
- 调研基础：`.omo/ulw-loop/ulw-research-twitter-cards-20260914/report.md`
- 主公择：A + B + C

## 目标

`app/layout.tsx` 根级 metadata 扩三档：
- **A** — `openGraph.locale = 'zh_CN'`；`openGraph.images[i].type = 'image/png'`；`openGraph.images[i].secure_url = 'https://3t.onepis.net/social-card-<variant>.png'`
- **B** — raw meta 注入 `twitter:label1/data1/label2/data2`（双行元数据）
- **C** — 多图变体 3 张入 `public/`，metadata.images 数组化

## 实施步骤

### Step 1 · 渲染 3 张变体 PNG（Playwright + design tokens）

- `social-card-home.png`（1280×640）— 战绩仪表板：累计胜/负/平、连胜 streak 标识、Hero「两人同设备 pass-and-play」
- `social-card-play.png`（1280×640）— 棋局中：3×3 棋盘（X O 落位 0,3,1,4,2 模拟）、Hero「对战 · tic-tac-toe」
- `social-card-result.png`（1280×640）— 胜局彩纸：彩纸动画静态、Hero「胜局 · tic-tac-toe」+ 战绩数字

设计令牌源（`app/globals.css`）：bg-base #0A0A0A · elevated #141414 · border-subtle #27272A · text-primary #FAFAFA · text-secondary #A1A1AA · accent #34D399 · player-o #FAFAFA

渲染脚本 `/tmp/render-tictactoe-cards-20260914.mjs`（沿用 `tests/qa/lib/browser.mjs` 启动器），三路由 / 一次性生成 3 PNG。

### Step 2 · 入仓 + public/ 副本

- 源文件入 `docs/social-card-{home,play,result}.png`（git 跟踪，供后续 Playwright QA 参考）
- `cp -p` 至 `public/social-card-{home,play,result}.png`（Next.js 静态服务）
- 字节级 cmp 验一致

### Step 3 · 改 `app/layout.tsx`

```ts
openGraph: {
  type: "website",
  siteName: "井字棋",
  url: "https://3t.onepis.net/",
  title: "井字棋 · 同设备 pass-and-play",
  description: "两人同设备轮流下的井字棋，自动记录战绩。",
  locale: "zh_CN",          // NEW
  images: [                  // CHANGED: 多图数组
    { url: "/social-card-home.png", width: 1280, height: 640,
      type: "image/png",     // NEW
      secure_url: "https://3t.onepis.net/social-card-home.png", // NEW
      alt: "井字棋 · 战绩仪表板" },
    { url: "/social-card-play.png", width: 1280, height: 640,
      type: "image/png", secure_url: "https://3t.onepis.net/social-card-play.png",
      alt: "井字棋 · 棋局对战中" },
    { url: "/social-card-result.png", width: 1280, height: 640,
      type: "image/png", secure_url: "https://3t.onepis.net/social-card-result.png",
      alt: "井字棋 · 胜局彩纸" },
  ],
},
twitter: {
  card: "summary_large_image",
  title: "井字棋 · 同设备 pass-and-play",
  description: "两人同设备轮流下的井字棋，自动记录战绩。",
  images: [                  // CHANGED: 数组化
    "/social-card-home.png",
    "/social-card-play.png",
    "/social-card-result.png",
  ],
  creator: "@onepisya",
  site: "@onepisya",
},
```

### Step 4 · raw meta 注入 `twitter:label1/data1/label2/data2`

Next.js metadata API 不暴露此四字段。在 `app/layout.tsx` JSX 顶层（root layout `<html>` 内、`<body>` 之前或 children 后）直渲：

```tsx
<meta name="twitter:label1" content="Built with" />
<meta name="twitter:data1" content="Next.js 16 · React 19" />
<meta name="twitter:label2" content="Type" />
<meta name="twitter:data2" content="Open source" />
```

React 19 允许 `<meta>` 在 root layout 中作为子节点直渲入 `<head>`，无副作用。

### Step 5 · 改 `app/layout.test.ts`

新增断言（与既有 RED-first 源文本模式一致）：
- `openGraph.locale = 'zh_CN'`
- `openGraph.images` 数组含 3 张图 url：`/social-card-home.png` / `/social-card-play.png` / `/social-card-result.png`
- 三张图各自 `type: 'image/png'` 与 `secure_url: 'https://3t.onepis.net/social-card-*.png'`
- `twitter.images` 数组含 3 张
- raw meta 4 条：`twitter:label1`/`data1`/`label2`/`data2`

预计断言 +8 条；总 vitest 111 → ~119。

### Step 6 · 六门 + commit

- `pnpm vitest run` · `pnpm typecheck` · `pnpm lint` · `pnpm build` · `node tests/qa/commit-audit.mjs --branch main` · `yaml safe_load`
- 全绿后 commit 一枚（攒批不 push）：
  - type: `feat(meta)`
  - subject: `部署站扩 Twitter card 双行元与多图变体（A+B+C）`
  - body: WHAT/WHY/HOW + 全套 lore trailer + Plan footer

## 验收标准

- AC1: `public/social-card-{home,play,result}.png` 三件各 1280×640 PNG（54KB ± 10%）
- AC2: 字节与 `docs/social-card-{home,play,result}.png` 一致（cmp -s）
- AC3: `app/layout.tsx` 含 og.locale + 3 图 type/secure_url + twitter label/data raw meta
- AC4: vitest 119 全绿（含新增 8 断言）
- AC5: 六门 fail=0
- AC6: 单 commit 攒批，不 push
- AC7: fresh codex 独立复核 V1-V6 全 PASS（另起 verifier tab）

## 边界

- 不动 lib/components/db/stores
- 零新依赖
- 不改 metadataBase
- 不改 og.type（维持 `website`）
- 不加 `twitter:app` / `twitter:player`（本仓无 native app/视频音频）
- 不动路由级 metadata（D 项不取）
- 不 push

## 风险

- 3 PNG 渲染 — 字体/satori 路径需验证（Playwright 渲应稳）
- raw meta 注 layout.tsx — 须验 Next.js 16 + React 19 允许 root layout 子节点 `<meta>` 直渲（实证 generate-metadata.md 文档例中含此模式）
- 多图数组化 — twitter.images 现有测试断言需同步改（单字符串 → 数组）

## 文件清单

| 文件 | 状态 |
|---|---|
| `docs/social-card-home.png` | new (git 跟踪) |
| `docs/social-card-play.png` | new |
| `docs/social-card-result.png` | new |
| `public/social-card-home.png` | new (字节同 docs) |
| `public/social-card-play.png` | new |
| `public/social-card-result.png` | new |
| `app/layout.tsx` | modify |
| `app/layout.test.ts` | modify |
| `/tmp/render-tictactoe-cards-20260914.mjs` | new (临时脚本) |