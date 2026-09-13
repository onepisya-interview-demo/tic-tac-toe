# Plan: ulw · 键盘劫持修复（ulw-keyboard-hijack-fix-20260913）

- 日期：2026-09-13
- ulw-loop：`.omo/ulw-loop/ulw-keyboard-hijack-fix-20260913/`
- 性质：产品代码修复（主公实测报障：「游玩中切换焦点之后无法返回首页
  和重新开局，因为键位被落子占用了」）

## 1. 病（码证）

`components/Board.tsx` 之 window 级 keydown handler（playing 相位挂载）
仅放行 INPUT 目标；格为原生 `<button>`，而「返回首页」「重新开局」亦
button。Tab 出盘至于钮上按 Enter/Space：handler preventDefault 灭其
原生 click，反落子于逻辑焦点格——**键盘出 game 之路断**。

## 2. 修

Enter/Space 分支前置守卫：目标非格（dataset.testid 非 cell-* 前缀）
而属可交互元素（button/a/input/textarea/select/contenteditable）且非
body → 让路（不 preventDefault 不落子）。箭头保持全局（随时把焦点
拉回棋盘，语义无害且有用）。

## 3. RED-first（docs/testing.md 契约）

新增 `components/Board.test.tsx` 三测：
- A Enter 于非格钮：原生 click 触发 + 未落子（修前 **红**，实证劫持）
- B Space 同上（修前 **红**）
- C 焦点格 Enter 落子（修前后皆绿，守既约）
先红后修：A/B 红 → 施刀 → 三绿。全套 105 → 108。

## 4. 验收标准

- AC1: 三新测绿；全套 vitest 绿无减
- AC2: typecheck / lint / build / audit --branch main 全绿
- AC3: 单 commit，trailer 全，subject 小写（非大写 ASCII 起），消息=授权件
- AC4: 不 push
- AC5（推后）: push 后 main CI 绿

## 5. 边界

- 不动 README（前刀「Tab 入盘…游玩无需鼠标」之宣在本修后始为真）
- 不动箭头全局行为、不动 result 页（非 playing 相位本无 handler）
