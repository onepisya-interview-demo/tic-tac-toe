# Plan: ulw · 部署站 SEO/Twitter 元信息（ulw-seo-meta-20260914）

- 日期：2026-09-14
- ulw-loop：`.omo/ulw-loop/ulw-seo-meta-20260914/`
- 授权：主公 2026-09-14 择 A（最小动：metadata API + public/ 副本）

## 背景与既裁事项

GitHub 仓 social preview 已生效（commit ba19ce5 后主公上传），但部署站
`https://3t.onepis.net` 三路由（`/` `/play` `/result`）皆无 `og:*` 与
`twitter:*` meta——第三方验证器实证，亦 `curl -A Twitterbot` 确认：
仅 `<title>`、`<meta name=description>`、`apple-mobile-web-app-title`。

根因：`app/layout.tsx` `metadata` 对象未设 `openGraph` 与 `twitter` 字段；
Next.js 16 不自动派生此二类 meta（实证 generate-metadata.md:682）。
`docs/social-card.png` 不在站点 URL 下——`public/` 才有静态托管路径。

## 方案 A（已裁）— Next 16 metadata API + public 副本

1. `public/social-card.png` ← `docs/social-card.png` 副本（同字节；保留 docs/
   副本供 GitHub Settings → Social preview 续用；仓内双份同源，吾图留做设计真源）
2. `app/layout.tsx` `metadata` 增二字段，根级即覆盖三路由：
   - `openGraph: { type:'website', siteName:'井字棋', title, description, url, images:[{ url:'/social-card.png', width:1280, height:640, alt:'井字棋 · tic-tac-toe 分享卡' }] }`
   - `twitter: { card:'summary_large_image', title, description, images:['/social-card.png'], creator:'@onepisya', site:'@onepisya' }`
3. `metadataBase` 维持 `https://3t-tic-tac-toe.vercel.app/`（Vercel 自动 cname
   跟随，`/social-card.png` 拼接得 `https://3t-tic-tac-toe.vercel.app/social-card.png`
   ——边缘随 cname 至 onepis.net；无需改动以免扰 SEO）

## RED-first / 测试

`layout.tsx` 含 `next/font/google`（Geist）于 module scope；直接 `import layout`
于 vitest（jsdom）会触发字体 loader——可能不可移植。两条备择：

- T1：`app/layout.test.ts` 以 `node:fs` 读源文本，断言含关键字段
  （`twitter:`, `summary_large_image`, `openGraph:`, `/social-card.png`）
- T2：直接 `import * as layout from './layout'` 取 `metadata` 字段
  ——若 Geist 在 jsdom 加载无错则 T2 优于 T1（深语义）；若报错降 T1

先试 T2；败则 T1。RED-first 不必起浏览器——meta 输出属非用户态契约，
仓内 108 测皆单元/集成层；此处加单元护 metadata 输出。

## 验收标准

- AC1: `public/social-card.png` 存在且与 docs/ 副本字节级一致
- AC2: `app/layout.tsx` metadata 含 `openGraph` + `twitter`（card=summary_large_image）
- AC3: 新单元测入仓并过；六门全绿
- AC4: commit 一枚（conventional docs/feat 兼顾），commit-audit --branch main fail=0
- AC5: 不 push；session id 录 .omo/sessions.local.md
- AC6: 设计决策落本 plan（已录）；ulw-loop 台账连贯
- AC7: 部署站 meta 真态需部署后 `curl` 验——出 commit 后请主公部署并以
  第三方验器复测；本批不做部署

## 设计决策落点

本 plan 即设计记录（commit-policy 要求非平凡 commit 必引 `.omo/plans/<slug>.md`），
附设计决策摘要于文末「设计决策摘要」节；不入 docs/decision-log.md（仓内无此
约定文件，无端新创）。

## 边界

- 不动 lib/app 内行为代码；不动 store/components/db；不动禁区三件
- 不引入新依赖
- 不 push；不绕过 commit-msg hook
- 路径别名 @/* 与现约定一致

## 执行序

1. 拷 docs/social-card.png → public/social-card.png（`cp -p` 守元数据）
2. 改 app/layout.tsx metadata（二字段增）
3. 写 app/layout.test.ts（先 T2 试，若 Geist 报错降 T1）
4. 六门：vitest / typecheck / lint / build / commit-audit / yaml
5. 攒 commit「feat(meta): 部署站增 og/twitter 元（next metadata API）」
6. fresh codex 对抗复核（独立 V1-V3 项）
7. 复核过则留待主公部署 + 第三方验器复测

## 设计决策摘要

- 为何不动 metadataBase：现指向 vercel.app；image 拼接稳定，Vercel 边缘
  自动跟 cname 至 onepis.net。改之或扰 SEO 与现有 og:url 缓存，无收益。
- 为何双份卡图（docs/ 与 public/）：docs/ 为 GitHub Social preview 真源；
  public/ 为站点 URL 真源；二者用途不同，不宜以 redirect 或单一源替代——
  GitHub Settings 上传界面只认 docs/social-card.png（手动上传后由 GH 托管
  于 repository-images.githubusercontent.com），与站点文件路径无涉。
- 为何选 Next metadata API 而非 app/twitter-image.tsx（文件约定）：后
  需重排卡面以 satori 渲 CJK（Geist 不含中文），且本仓设计令牌约束暗底
  /accent，对应卡图已落 docs/social-card.png——复用比重渲更稳，更小改
  动面，符合「禁新依赖/UI 库」之约。