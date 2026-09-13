# Plan: ulw · 修 package.json 元数据错 slug（ulw-meta-slug-fix-20260913）

- 日期：2026-09-13
- ulw-loop：`.omo/ulw-loop/ulw-meta-slug-fix-20260913/`

## 1. 现象

发布前 session 假设 owner=`onepisya`，实际发布仓为
`onepisya-interview-demo/tic-tac-toe`。package.json 三字段仍指旧假设：

- `repository.url`: `git+https://github.com/onepisya/tic-tac-toe.git`
- `homepage`: `https://github.com/onepisya/tic-tac-toe#readme`
- `bugs.url`: `https://github.com/onepisya/tic-tac-toe/issues`

影响：GitHub 侧 social preview / package 元数据 / issues 链接全空指。

## 2. 修法（单刀）

三字段 owner 皆 `onepisya` → `onepisya-interview-demo`，路径与其余不动。
经 `git grep` 全仓核对（tracked 文件）确认无第四处需改：
`.omo/plans/*.md` 中旧 slug 为**历史设计记录，禁止改写**。

## 3. 验收标准

- AC1: `git grep -n "github.com/onepisya/" -- package.json` = 0 命中；
  三字段精确等于上表替换
- AC2: `git grep "onepisya/tic-tac-toe"` 仅剩 .omo/plans 历史记录
- AC3: `pnpm typecheck` 0（package.json 变更不破导入）
- AC4: 六门绿（audit --branch main 预期 164/164：162+先 CI 合并二 commit
  已计入 remote，本地计数以实测为准）
- AC5: 单 commit，subject 小写起，trailer 英文枚举，消息=授权件逐字节同
- AC6: 不 push

## 4. 边界

- 不动 .omo/plans/、README、SECURITY（决策项另议）
- 不动 npm 依赖版本（package.json 仅元数据三行）
