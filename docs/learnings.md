# 学习笔记（Learnings）— 踩坑与版本记录

> 练习项目，记录给未来的人类与 AI。每条都有仓库内证据（commit / plan / 代码位置）。

## 坑与解法

### 1. SoundToggle hydration mismatch（commit 6518c79）
SSR 渲染读取 localStorage 会让首帧不一致（React 抛 hydration 警告）。解法：useState(true) 固定默认 +
useEffect 挂载后 getMuted() 同步；测试用 renderToString + 令 localStorage.getItem 抛错模拟真 SSR。

### 2. /result 刷新战绩为空（commit 3dd9796，.omo/plans/result-stats-reload.md）
hydrateStats 动作存在但无人调用。解法：store 模块在浏览器加载时 kick off 一次 hydrateStats（typeof window 守卫），
SSR 不执行。教训：Zustand action 不会自己跑，持久化读取要找显式触发点。

### 3. 音频合成与 autoplay 策略（win-cheer 方案，.omo/plans/win-cheer.md）
AudioContext 必须在用户手势后 lazy 创建；headless QA 用 --autoplay-policy=no-user-gesture-required +
给 AudioContext 打补丁数振荡器（move 1 + win 2 + cheer 6 = ≥12）。win→cheer 用 setTimeout(…,360) 排序，
playSound('cheer') 内部重读 mute，中途静音仍会静下来。

### 4. 先手随机 vs 确定性 QA
每局随机先手会让"固定走位"剧本不稳定。通用解法：走 0,3,1,4,2 —— 无论谁先手都赢上排
（tests/qa/lib/win-drive.mjs，一处定义五处复用）。

### 5. commitlint 拥抱中文提交（commit-policy-zh 计划）
Conventional 前缀保留英文 token（工具兼容），subject/body/trailer 值可中文；trailer 键名必须英文
（插件按键名解析）。审计关键词在 tests/qa/commit-audit.mjs 与 commitlint.config.cjs 双处登记。

## 版本相关

| 事项 | 说明 |
| --- | --- |
| Next.js 16.3.4 | 项目自述"不是你认识的 Next.js"：node_modules/next/dist/docs/ 有内置指南；代理规则块由 next dev 自动再生成，next-env.d.ts 的 dev-types 路径被刻意跟踪（e21d7ff） |
| React 19 + App Router | Server Component 默认，交互组件显式 'use client' |
| Tailwind v4 | @theme 自定义 token（DESIGN.md 契约），不用 stock 色板 |
| vitest 5 | 启动时有 configLoader native 警告（ESM 语法被按 CJS 加载）；无害，未来大版本会变默认 |
| Stryker | 沙箱目录 .stryker-tmp/ 需在 vitest exclude 里，否则变异运行会误收集依赖测试 |
| Drizzle + better-sqlite3 | 单行战绩表 id=1，WAL 模式；Vercel 部署需换 Turso/LibSQL（README 已注明） |
