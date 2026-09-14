# Plan: ulw · Twitter card 类型与策略调研（ulw-research-twitter-cards-20260914）

- 日期：2026-09-14
- ulw-loop：`.omo/ulw-loop/ulw-research-twitter-cards-20260914/`
- 授权：主公 2026-09-14「Twitter card 类型调研+改进」

## 背景

前批 2879b2f 已采 `summary_large_image` 卡型 + 1280×640 暗底三帧拼版。
主公察 Twitter card 类型众，欲知全景与本仓之优配。

## 调研目标

A · 全集枚举——四主型 + 次级字段（label/value、image 多图等）
B · 各型适用场景——本仓（产品着陆页、portfolio）何配最优
C · Next.js 16 metadata API 之 twitter / openGraph 字段全集与限制
D · X 平台 2024-2026 最新行为变化——card 渲染优先级、爬取策略
E · 本仓可补字段候选清单（按收益/复杂度排序）

## 调研源

- Next.js 16 generate-metadata.md（node_modules）
- Twitter Cards docs（developer.twitter.com / docs.x.com）
- ogp.me / opengraphprotocol.org — og: 字段全集
- 类似 portfolio 项目（vercel/next.js / vercel/examples）设例
- 2025-2026 X 行为报告（web search）

## 调研法

- 网络查 + 本地 node_modules 查
- 全部只读，不动仓
- 产出调研报告 → `.omo/ulw-loop/ulw-research-twitter-cards-20260914/report.md`
- 候选清单按 A/B/C/D 分级；待主公择而后方写改动 plan

## 验收标准

- AC1: 调研报告落 `.omo/ulw-loop/ulw-research-twitter-cards-20260914/report.md`
- AC2: 候选清单 ≥3 项，含每项收益/复杂度/风险评估
- AC3: 不动工作树（除本计划档与报告档）
- AC4: 主公择后另立 ulw 改动 plan

## 边界

- 不动手实施
- 不 push
- 不 spawn 改动 agent（仅调研可直行）