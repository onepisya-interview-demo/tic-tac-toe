# Plan: ulw-meta-brand-mark-20260914 · 1:1 brand mark 作 og fallback

- 日期：2026-09-14
- ulw-loop：`.omo/ulw-loop/ulw-meta-brand-mark-20260914/`
- 前批：`c16e9e8` A+B+C 已 push-pending
- 主公择：E（调研 §五）

## 目标

加一张 1:1 PNG brand mark 入 `openGraph.images[3]` + `twitter.images[3]` 作 fallback（小图标 / Slack/IM 头像 / favicon 备图）。X 仍按 `card='summary_large_image'` 渲大图，但小图标可作多场景备图。

## 实施步骤

### Step 1 · 设计 brand mark

512×512 PNG，1:1。设计令牌取 `app/globals.css`：
- bg-base #0A0A0A（全底）
- accent #34D399（X — 绿色）
- text-primary #FAFAFA（O — 浅色）
- 居中构图：X 字符在左上 + O 字符在右下 + 微井字风格（中央可加细线分隔）

布局参考（512 坐标空间）：
- 整图 #0A0A0A 底
- 中央 1px 分隔线（border-subtle #27272A）十字
- 左上 X：绿色 #34D399，font-weight 700，字号 ~ 200
- 右下 O：浅色 #FAFAFA，font-weight 700，字号 ~ 200
- 「井字棋」字样底部小字 24px（text-secondary #A1A1AA），可选

文件大小预期 ~30KB（PNG）。

### Step 2 · 渲染 + 入仓 + public/ 镜像

- 渲染脚本 `/tmp/render-tictactoe-brandmark-20260914.mjs`（Playwright via `tests/qa/lib/browser.mjs` 启动器）
- 出 `docs/social-card-brandmark.png` + `cp -p` 至 `public/social-card-brandmark.png`
- `cmp -s` 验字节一致 + `file <png>` 验 512×512 PNG

### Step 3 · 改 `app/layout.tsx`

```ts
openGraph: {
  ...
  images: [
    { url: "/social-card-home.png", width: 1280, height: 640,
      type: "image/png", secure_url: "https://3t.onepis.net/social-card-home.png",
      alt: "井字棋 · 战绩仪表板" },
    { url: "/social-card-play.png", width: 1280, height: 640,
      type: "image/png", secure_url: "https://3t.onepis.net/social-card-play.png",
      alt: "井字棋 · 棋局对战中" },
    { url: "/social-card-result.png", width: 1280, height: 640,
      type: "image/png", secure_url: "https://3t.onepis.net/social-card-result.png",
      alt: "井字棋 · 胜局彩纸" },
    // NEW: 1:1 brand mark, fallback for small/avatar contexts
    { url: "/social-card-brandmark.png", width: 512, height: 512,
      type: "image/png",
      secure_url: "https://3t.onepis.net/social-card-brandmark.png",
      alt: "井字棋 · brand mark" },
  ],
},
twitter: {
  ...
  images: [
    "/social-card-home.png",
    "/social-card-play.png",
    "/social-card-result.png",
    "/social-card-brandmark.png",  // NEW
  ],
},
```

### Step 4 · 改 `app/layout.test.ts`

新增断言：
- `openGraph.images` 含 `/social-card-brandmark.png` url + `width: 512` + `height: 512` 模式
- `twitter.images` 含 `/social-card-brandmark.png`

预计 +2 断言（it 块内 expect，或独立 it 块）；vitest 115 → ~117。

### Step 5 · 六门 + commit

- `pnpm vitest run` · `pnpm typecheck` · `pnpm lint` · `pnpm build` · `node tests/qa/commit-audit.mjs --branch main` · yaml
- 全绿后 commit 一枚（攒批不 push）：
  - type: `feat(meta)`
  - subject: `增 1:1 brand mark 作 og fallback`
  - body: WHAT/WHY/HOW + 全套 lore trailer + Plan footer

## 验收

- AC1: `public/social-card-brandmark.png` 512×512 PNG（~30KB ± 50%）
- AC2: 字节与 `docs/social-card-brandmark.png` 一致
- AC3: `app/layout.tsx` images 数组增第 4 项（512×512 brand mark）
- AC4: vitest 117 全绿（含新增 ≥2 断言）
- AC5: 六门 fail=0
- AC6: 单 commit 攒批不 push
- AC7: fresh codex 独立复核 V1-V6 全 PASS

## 边界

- 不动 c16e9e8 已落之 3 张图 / og locale / twitter 双行元
- 不改 metadataBase
- 不改 og.type / twitter.card
- 不动 lib/components/db/stores
- 零新依赖

## 文件清单

| 文件 | 状态 |
|---|---|
| `docs/social-card-brandmark.png` | new (git 跟踪) |
| `public/social-card-brandmark.png` | new (字节同 docs) |
| `app/layout.tsx` | modify (images 增第 4 项) |
| `app/layout.test.ts` | modify (+ 断言) |
| `/tmp/render-tictactoe-brandmark-20260914.mjs` | new (临时脚本) |