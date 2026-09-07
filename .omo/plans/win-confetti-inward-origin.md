# Brief: 胜利彩纸两侧发射点向中间内聚 (option B — 桌面端 origin.x 0.18/0.82)

依据: 用户在 /result 结算页胜利动效上的视觉反馈（"两边的出发点可以向中间靠一点"）。
本 brief 套用用户的 5 段式框架（问句 / 陈述 / 约束 / 例子 / 非目标），
外加 `## Commit` 块与项目 Plan: footer 约定（AGENTS.md:175-186）。

---

## 1. 问题（问句）

`lib/confetti.ts:63-64` 的桌面端 (≥1280px) 胜利彩纸把两个 `origin.x` 硬编码为
`0` / `1`（即屏缘），60° / 120° 的方向角让两束粒子在屏外"对射" — 视觉上
像两门对开的炮口，而不是庆祝。能否让两边起点向中间靠一点，让彩纸在屏内
更聚拢？

---

## 2. 目标（陈述句）

把桌面端 (≥1280px) 胜利彩纸的左右两个 `origin.x` 从 `0` / `1` 改为
`0.18` / `0.82`（约 18% 屏宽内移）。仅平移发射点：保留 `origin.y=0.96`、
方向角 60° / 120°、`BURST_DURATION_MS=1100`、`PARTICLES_PER_FRAME=4`、
`PALETTE`（7 色）、`spread=70`、`startVelocity=45`、`gravity=0.9`、
`ticks=220`、`scalar=1.1`、`prefers-reduced-motion` 跳过逻辑全部原样。
平板 / 手机端 (<1280px) 的 mid-edge (y=0.55, x=0/1) 行为完全不变。

---

## 3. 硬约束

- **作用域**: 仅改 `lib/confetti.ts` 中桌面分支的 `origin.x`；mobile/tablet
  分支的 x 与 y 都不动。
- **不变项**: `angle` 60° / 120°、`origin.y=0.96` (桌面) 与 `0.55` (移动)、
  `BURST_DURATION_MS=1100`、`PARTICLES_PER_FRAME=4`、`PALETTE`、`spread=70`、
  `startVelocity=45`、`gravity=0.9`、`ticks=220`、`scalar=1.1`、
  `prefers-reduced-motion` 跳过逻辑 — 全部保留。
- **不动的文件**: `components/Confetti.tsx`（只挂载，不读 origin）、
  `app/result/page.tsx`、`app/globals.css`。
- **中心 UI 安全区**: `data-testid="result-headline"` 与
  `data-testid="play-again"` 在新发射点下必须保持可点、不被粒子遮挡。
- **验证门**（AGENTS.md:227-243）必须全绿:
  - `pnpm vitest run` — 67/67 不减
  - `pnpm typecheck` / `pnpm lint` — 干净
  - `pnpm build` — 5 routes
  - `node tests/qa/confetti-origin-qa.mjs` — 两个视口下都 PASS
- **测试同步**: `lib/confetti.test.ts:72` 的桌面 x-pair 期望
  `[0, 1]` 须改为 `[0.18, 0.82]`（用 `toBeCloseTo` 容忍浮点）。
  L48-49 / L103 / L106 等其它断言不破（mobile 路径仍 0/1, y 仍
  0.95-1 / 0.55），保持原样即可。
- **QA 探针同步**: `tests/qa/confetti-origin-qa.mjs:61-62` 的像素
  采样带 `leftX = width*0.05` / `rightX = width*0.95` 必须重锚到
  新发射点 0.18 / 0.82 附近（建议 `0.13..0.23` / `0.77..0.87`
  窗口），并把 step 名称从 "from the bottom band at both edges"
  改为 "from the inward origin at both sides"。

---

## 4. 具体例子（锚定理解）

**修改前** — `lib/confetti.ts:63-64` 当前实现:

```ts
const tick = (): void => {
  fire(0, 60, originY);   // bottom-left corner → upper-right
  fire(1, 120, originY);  // bottom-right corner → upper-left
  if (Date.now() - start < BURST_DURATION_MS) {
    requestAnimationFrame(tick);
  }
};
```

1440x900 视口下，两条流分别从 `x=0px`（最左缘）与 `x=1440px`（最右缘）
喷出，肉眼读作"屏外射入"，屏缘 0px 内即有粒子源。

**修改后** — 引入桌面专用内聚常量并条件化 origin.x:

```ts
// 桌面端 (>=1280px) 内聚发射点：18% 屏宽内移，让粒子在屏内涌出而非屏外射入。
// 平板/手机端保持原 x=0/1（mid-edge 路径只切 y 起点）。
const DESKTOP_LEFT_X = 0.18;
const DESKTOP_RIGHT_X = 0.82;
const MOBILE_LEFT_X = 0;
const MOBILE_RIGHT_X = 1;
...
const isDesktop = isDesktopLayout();
const originY = isDesktop ? 0.96 : 0.55;
const leftX = isDesktop ? DESKTOP_LEFT_X : MOBILE_LEFT_X;
const rightX = isDesktop ? DESKTOP_RIGHT_X : MOBILE_RIGHT_X;
const tick = (): void => {
  fire(leftX, 60, originY);
  fire(rightX, 120, originY);
  if (Date.now() - start < BURST_DURATION_MS) {
    requestAnimationFrame(tick);
  }
};
```

1440x900 视口下，两条流分别从 `x≈259px` 与 `x≈1181px` 喷出，屏缘
各留 ~260px (≈18% 屏宽) 空白，粒子仍在屏内"涌出"再向中上交叉。

**回归验收** — 同帧画面里:

- `data-testid="result-headline"`（居中标题）仍可被 Playwright
  `page.locator(...).textContent()` 读取，不被新发射点的粒子即时遮挡。
- `data-testid="play-again"` 按钮的 `page.click()` 仍 200ms 内可达。
- `tests/qa/confetti-origin-qa.mjs` 在桌面 1440x900 视口下，新采样带
  仍能采到 ≥ 10 像素的内聚带粒子（step 仍 PASS）；中心 UI click
  步骤（line 154-160）仍可达。

---

## 5. 非目标（out of scope）

- 不引入新动效库（如 lottie / mo.js / 3D 旋转 / 角度动画）。
- 不改 `PALETTE`（7 色调色板保留：accent / hover / warm / cool 等）。
- 不改 `BURST_DURATION_MS=1100` 节奏（不需要"延后"或"加速"）。
- 不改 `angle` 60° / 120°（已正确交叉，单纯平移即可，不重调方向）。
- 不动 `prefers-reduced-motion` 跳过行为。
- 不调整平板/手机端 (origin.y=0.55) 的中部起点。
- 不增加 `data-testid` 钩子（只有 `data-testid="confetti"` 一处已够用）。
- 不做 viewport-relative（用 px 锁定而非比例值）方案 — 留作未来 A/B。
- 不为 A/B 实验多套发射点（本期仅一组固定常量）。
- 不写新的端到端音频探针（音效与本改动正交，由 `win-cheer.md` 覆盖）。
- 不重写 `burstConfetti()` 整体结构（保持 rAF tick 形态，不引入
  Promise / async pipeline）。

---

## Commit

一条原子 commit，挂在当前 `main`（提交规范见 `AGENTS.md:25-122`）:

- **subject**: `feat(animation): 把胜利彩纸两侧发射点内聚到 0.18/0.82`
- **body**（WHAT / WHY / HOW 三段）:
  - **WHAT**: 把 `lib/confetti.ts` 的桌面分支 `origin.x` 由 `0` / `1` 改为
    `0.18` / `0.82`，并同步更新 `lib/confetti.test.ts` 与
    `tests/qa/confetti-origin-qa.mjs` 的期望与采样带。
  - **WHY**: 用户反馈胜利彩纸从屏缘喷出像"对射"而非庆祝；桌面端
    18% 内聚让粒子在屏内涌出再交叉，读作"庆祝"（意图见本 brief §1）。
  - **HOW**: 引入 `DESKTOP_LEFT_X` / `DESKTOP_RIGHT_X` 常量并通过
    `isDesktopLayout()` 条件分支切换 `fire()` 第一参数；mobile/tablet
    路径完全不动；测试用 `toBeCloseTo` 锁新值；QA 像素采样带从
    `width*0.05/0.95` 重锚到 0.18/0.82 附近。
- **Footer**: `Plan: .omo/plans/win-confetti-inward-origin.md`
- **lore trailers** (按 AGENTS.md:93-101):
  - `Constraint:` 仅改 x，y/angle/时长/配色 全部冻结
  - `Rejected:` 0.25/0.75（rule-of-thirds）— 与中心 headline 安全区冲突
  - `Rejected:` viewport-relative 像素锁定 — 增加复杂度且需重写 QA 探针
  - `Confidence: medium` — magnitude 0.18/0.82 是推荐值不是用户给定的硬数
  - `Scope-risk: narrow` — 仅一个核心文件 + 两个测试文件
  - `Tested:` `pnpm vitest run` 全绿 / QA 探针 PASS（待落地后补）
  - `Not-tested:` 跨屏宽 1280-2560px 范围的实际视觉效果（需手动或
    Playwright 视口矩阵覆盖）
