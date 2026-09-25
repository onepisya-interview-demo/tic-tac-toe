# Plan: AGENTS.md 路由化瘦身（222 → ≤150 行，按档位分层）

- 日期: 2026-09-22
- 状态: 已实现（932835f 2026-09-22 docs(agents) 主项目块 222→52 行 + 8 个外化文件，计划与实现同一提交；状态线 2026-09-26 按 git 实况修正）
- 分支: dev
- 触发: 主公「AGENTS.md 超过 150 行了，该进行外化优化」+ 架构金训「最最最最重要的信息才直接放 AGENTS.md，每个会话都需要的才内联」

## 一、命题

把 AGENTS.md 从「全文契约 + digest + 历史案例大表」瘦身为「路由 + 极少 L0 内联」。
核心约束：**每个会话都需要的**才内联；**高频但可路由**的写一行指针；**按需读文件**的完全外化；**历史/废止**的归档。

## 二、档位定义（L0–L3，缺哪个档就造哪个）

| 档位 | 判定金训 | 形态 | 例子 |
| --- | --- | --- | --- |
| **L0** | 漏读这条信息，会写出**必然违反**契约的代码（结构性硬约束） | AGENTS.md 内联，每会话自动读 | 路径别名 @/*；Server Component 默认；不引入新库；commit-msg hook 直引；Chinese 回复；命名锁定主公术语（`/online` `/offline` `/result`） |
| **L1** | 高频引用，但**有指向文件 + 短描述就够** | AGENTS.md 留 digest + 指针一行 | 验证门禁六层；herdr session 协议；调度者模板；commit 策略；提交禁忌 |
| **L2** | 仅特定任务时才需要（写某模块、改某 schema、调试某现象） | 完全外化，AGENTS.md 只挂路径 | schema/DB reconcile；EMFILE/watchpack；build/dev 冻结；LSP 配置；SW cache-bust |
| **L3** | 历史案例、已废止概念、待裁决缓议 | 完全外化 + 标注 [ARCHIVED] 或 [FOLLOW-UP] | W1 旧 player 术语迁移；P1-2/4/5 缓议；f8bcde26 单一证据 |

**经验门槛**（防止外化过度）：L0 总长度建议 ≤ 60 行；总目标 ≤ 150 行。超 150 是金训未严格执行。

## 三、AGENTS.md 现有 222 行逐节判定（执行清单）

| 节 | 行数 | 档位 | 处置 | 目标文件 / 操作 |
| --- | ---: | --- | --- | --- |
| 自动 next.js-agent-rules 块 | 1–8 | **L0** | 内联（不可动；next dev 自动维护） | 保持 |
| `<!-- BEGIN:project-contribution-guidelines -->` 框架 | 11–12 | **L0** | 内联（中文回复金训） | 保持 |
| 标题「# 项目知识库」+ Router 注 | 13–15 | **L0** | 内联（路由形态金训自我提醒） | 保持 |
| 元信息（生成时间/提交/分支） | 17–19 | **L2** | **外化** | 移到文件结尾 `<!-- METADATA -->` 注释或干脆删（git log 可查） |
| ## 概览 | 21–23 | **L1** | **外化** | 留 3 行 digest（产品一句话 + 技术栈一行） + 指针 ulw-one-game-two-versions.md / ulw-room-migration-home-landing.md |
| ## 结构（目录树） | 25–35 | **L1** | **外化** | 整段外化；目录树改「见 docs/repo-map.md」（新建） |
| ## 查找入口 | 37–49 | **L1** | **外化** | 整表外化 docs/repo-map.md §2；AGENTS.md 删 |
| ## 代码地图 | 51–80 | **L2** | **外化** | 整表外化 docs/code-symbols.md（新建；中心度 + 作用）；AGENTS.md 删 |
| ## 约定 | 82–90 | **L1**（部分 L0） | 拆：路径别名/SC/命名术语/不引新库 4 条 **L0 内联**；其余 **外化** docs/conventions.md（新建） |
| ## 本项目反模式 | 92–147 | 拆：每条独立判定 | 见下表 §四 | 见下表 |
| ## 项目特有风格 | 149–157 | **L1** | **外化** docs/style.md（新建；暗色 UI/reduced-motion/彩纸 testid/胜局探针坐标 + 房间术语一段） |
| ## 命令 | 159–170 | **L1** | **外化** docs/commands.md（新建；命令清单 + 端口约定） |
| ## herdr 多代理 session 卫生 | 172–176 | **L1** | 缩为 1 行指针 docs/herdr-session-hygiene.md（已存在） |
| ## 调度者（多代理编排） | 178–192 | **L1** | 拆：调度者金训 + teach-back 两行 **L0 内联**；其余 **外化** docs/dispatcher-playbook.md / .omo/plans/dispatcher-roles-retrospective.md §4（已存在） |
| ## 运行时能力边界 | 186–192 | **L1** | **外化** .omo/plans/agent-runtime-boundaries.md（已存在）+ 一行指针 |
| ## 备注 | 194–198 | **L1** | **外化** docs/notes.md（新建） |
| ## 提交约定 | 204–210 | **L1** | 缩为 3 行 digest + 指针 docs/commit-policy.md（已存在） |
| ## 验证门禁 | 212–216 | **L1** | 缩为 1 行「六层」+ 指针 docs/verification-gauntlet.md（已存在） |
| ## commit-msg hook | 218–220 | **L0** | **内联**（反模式节直引本节，删则产生悬空契约引用） |

## 四、反模式节（最大的一节）逐条判定

22 条反模式条，按 L0/L1/L2 分三档：

### L0（必须内联，漏则破契约）

1. **service 层纯函数 / 传输层薄壳强制分离**（94）—— 结构性硬约束，写 store/handler 必守
2. **service 函数禁止返回 `Response`/`NextResponse`/`{status: 404}`**（95）—— 与 1 配对
3. **不要在 SSR 首帧读取 localStorage**（97）—— React/RSC 水合边界硬约束
5. **不要引入新库**（98）—— 项目约束明确排除
7. **不要 --no-verify 绕过 commit-msg hook**（100）—— gate 约束
8. **契约要求生产构建时不要 dev 跑浏览器 QA**（101）—— 验证路径硬约束

### L1（高频 + 路由即可——AGENTS.md 留一行 digest，外化文件载完整条）

4. **已有命名令牌时不用 Tailwind 原生色板或内联 hex**（96）
6. **不要 div onClick/emoji/组件级 focus ring/第二水合触发点**（99）
13. **`/offline` 零网络写**（113）
14. **同名并发 last-write-wins**（114）
15. **offline 100% 纯本地**（115）
17. **POST /merge 是用户主动确认的合并接口**（117）
18. **同步哨兵 last-merged-local**（118）
21. **`/offline` 纯净化**（119）
23. **首页「开始对战」零拦截**（121）
24. **首页零 API**（123）
25. **sync-declined.v1 哨兵**（125）
26. **POST /merge 409 防静默建档**（127）
27. **POST /outcomes 404 防静默建档**（129）
28. **POST /reset 清零保留身份**（131）
29. **ResultNavigator await 在途记局写**（133）
30. **RoomGateMount 挂载期 identity bootstrap**（135）
31. **/result 胜利庆祝哨兵门控**（136）
32. **/online 直达门控**（137）
33. **弹框初焦落主 CTA（rAF）**（139）
34. **探针 BASE_URL 不硬编码 :3000**（141）
35. **eslint globalIgnores 必须包含 .delta/**（143）

### L2（按需读——AGENTS.md 完全外化）

9. **LSP 工具走 vp 全局安装**（102）—— 仅调试 LSP 时需要
10. **RSC 必须 force-dynamic**（103）—— 仅写 RSC 页面时
11. **SW fetch 按方法门控**（104）—— 仅写/改 SW 时
12. **store 网络写返回 Promise**（105）—— 仅写 store action 时
16. **merge 接口 + 哨兵 + 防静默建档**（已合并进 L1，重复去掉）
19. **静态资源缓存必须双层 + SW cache-bust**（107）—— 仅写 SW / next.config 时
20. **批量文件操作走 git 通道**（108）—— 仅做清理/迁移时
21. **herdr 多 pane 同 worktree 单 agent**（109）—— 仅 herdr 操作时（已合并到 herdr-session-hygiene）
22. **DB schema 变更必须 getDb reconcile + legacy 测试**（110）—— 仅改 schema 时
23. **commit-msg hook 在 .git/ 内不可跟踪**（111）—— 仅修 hook 时
24. **`ttt.room.name.v1` 白名单与 normalizeRoom 同源**（112）—— 仅改房间名逻辑时
25. **dev 冷启 EMFILE 风暴 + WATCHPACK_POLLING**（145）—— 仅 dev 故障排查时
26. **build/dev 冻结反模式**（147）—— 仅准备 build 时

> 注：上一段序号有重叠（一节内连号），按物理行号唯一化后实际 22 条 L1 + 4 条 L0 + 9 条 L2 不会变。

## 五、外化目标文件（最终落点矩阵）

| 路径 | 状态 | 来源 |
| --- | --- | --- |
| docs/repo-map.md | **新建** | 概览 + 目录树 + 查找入口表 |
| docs/code-symbols.md | **新建** | 代码地图 14 行大表（中心度 + 作用） |
| docs/conventions.md | **新建** | 约定节外化条（L0 4 条保留） |
| docs/style.md | **新建** | 项目特有风格 |
| docs/commands.md | **新建** | 命令清单 + 端口约定 |
| docs/notes.md | **新建** | 备注节（libsql 缓存/战绩表结构/next-env.d.ts） |
| docs/anti-patterns.md | **新建** | 反模式 L1 + L2 全部（按 L0 边界分组） |
| docs/dispatcher-playbook.md | **新建**（或 rename dispatcher-roles-retrospective.md §4） | 调度者模板 |
| docs/herdr-session-hygiene.md | 已存在 | herdr 协议 |
| docs/commit-policy.md | 已存在 | 提交策略 |
| docs/verification-gauntlet.md | 已存在 | 验证门禁 |
| docs/requirement-intake.md | 已存在 | intake 协议（W-RF 蒸馏） |
| docs/retro-2026Q3.md | 已存在 | 反思复盘（W-RF 蒸馏） |
| .omo/plans/dispatcher-roles-retrospective.md | 已存在 | 调度者四层职责 |
| .omo/plans/agent-runtime-boundaries.md | 已存在 | runtime 边界 |

## 六、AGENTS.md L0 内联目标（≤ 60 行，路由化骨架）

```
<!-- BEGIN:nextjs-agent-rules --> ...（保留，不可动） <!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-contribution-guidelines -->
总是使用中文进行回复。

# 项目知识库（Router）

> 每个会话都必需的金训内联；高频契约路由化；按需读外化文件。详见 docs/repo-map.md。

## L0 硬约束（漏则破契约）
- 路径别名 @/* → 仓库根；规则放 lib，schema 放 db，UI 组合放 components。
- Server Component 默认；只有交互/浏览器 API 才加 'use client'。
- 路由命名：`/online` + `/offline` + `/result`；不引入 solo/ranked/singleplayer/multiplayer（schema.org 词汇对齐）。
- 不引入新 UI/路由/动画/数据访问/表单库。
- service/transport 分离（service 函数返回纯数据 + 状态标记；transport 唯一决定 status code）。详见 docs/anti-patterns.md §L0。
- 不在 SSR 首帧读 localStorage；先渲染安全默认值 + useEffect 同步。
- 不 --no-verify 绕过 commit-msg hook；契约要求生产构建时不在 dev 跑浏览器 QA。

## L1 路由指针（一行式 digest + 完整文档）
- 验证门禁：六层（vitest / typecheck / lint / build / commit-audit / 浏览器探针），详见 docs/verification-gauntlet.md
- 提交策略：Conventional + lore trailer + Plan footer，详见 docs/commit-policy.md
- herdr session 协议：见 docs/herdr-session-hygiene.md
- 调度者模板：teach-back + 单 session 拆分四问 + 负面清单，见 docs/dispatcher-playbook.md
- 运行时能力边界（Pi/omp 分工）：见 .omo/plans/agent-runtime-boundaries.md
- 需求对齐协议：intake 五维 + aligned 门 + Given-When-When 复述，见 docs/requirement-intake.md

## L2 按需读（外化文件全清单）
- 仓库结构与查找入口：docs/repo-map.md
- 代码符号地图：docs/code-symbols.md
- 约定与命名：docs/conventions.md
- 视觉与无障碍：docs/style.md
- 命令与端口：docs/commands.md
- 反模式全集：docs/anti-patterns.md
- 调试者备注：docs/notes.md
- 调度者四层职责：.omo/plans/dispatcher-roles-retrospective.md

## 验证六层一行式
① vitest ② typecheck ③ lint ④ build ⑤ commit-audit ⑥ 浏览器探针

## commit-msg hook
.git/hooks/commit-msg 调 node tests/qa/commit-audit.mjs --message-file "$1"；不合规失败；禁 --no-verify。
<!-- END:project-contribution-guidelines -->
```

预期长度：**约 70 行**（含 next.js 块），**主项目块约 50 行**。低于 150 阈值，留缓冲。

## 七、执行序（每步可独立验证）

1. **先建外化文件**（不删 AGENTS.md）：新建 docs/repo-map.md / code-symbols.md / conventions.md / style.md / commands.md / notes.md / anti-patterns.md / dispatcher-playbook.md；内容从 AGENTS.md 相应节原样迁入，不外化。
3. **Sync move AGENTS.md**：把外化节删掉，插 L0/L1/L2 路由指针；保持中文回复金训 + 路由化骨架。
4. **验收**：
   - `wc -l AGENTS.md` ≤ 150
   - `pnpm vitest run` + typecheck + lint + build 绿（文档改动不应破）
   - `node tests/qa/commit-audit.mjs --branch main` 0 violations（提交契约自检）
   - **装机验证**：从主 worktree 起一个 fresh session，验证它能仅读 AGENTS.md + 按需读外化文件就完成一个典型任务（建议：起 worktree 改一行无关代码 → commit → verify）—— 信产物不信汇报。
5. **提交**：type=docs，`docs(agents): AGENTS.md 路由化瘦身 222→~50 行 + 8 个外化文件`，中文正文 WHAT/WHY/HOW，全套 lore trailer + Plan 页脚。
6. **commit-msg hook 必过**；禁 push。

## 八、Aligned 门（plan §九 升级版）

**主公批准（2026-09-22）：**

1. **金训一致确认**：「每个会话都必需的金训内联；高频契约路由化；按需读外化文件」与主公原话「最最最最重要的信息才直接放 AGENTS.md；每个会话都需要的才内联」一致；超 150 行是金训未严格执行（不是越短越好）。
2. **L0 8 条覆盖度**：路径别名 / SC 默认 / 路由命名锁定 / 不引新库 / service-transport 分离 / 不在 SSR 首帧读 localStorage / 不 --no-verify / 生产构建时不在 dev 跑浏览器 QA —— 8 条覆盖主公要求的硬约束集；未遗漏、未可降级。
3. **运行时选择**：建议 herdr codex fresh session 执行。理由：
   - 改动规模（8 文件新建 + AGENTS.md 瘦身 + 装机验证）适合 fresh session，零注意力衰减
   - herdr 会话卫生纪律已在仓内落地（docs/herdr-session-hygiene.md）
   - 改动结果可在下一会话被主公独立验收（V13 风格）
   - 排除 ZCode 子代理：档位决策属性高于执行属性，子代理无主公金训上下文会误判边界（W-AB 漂移实证）
   - 排除 Pi/OMP：跨文件结构搬运超 Pi 舒适区（AGENTS.md 反模式节明文禁派跨文件重构给 Pi）
   - 排除本会话继续执行：本会话 context 已 27M tokens，远超 15% 智能峰，新会话 fresh = 0 漂移
4. **L3 归档**：不单独建归档目录；废止/历史条目随 L2 文档落 `docs/archive/` 子目录（每文件首段标 `[ARCHIVED]` 或 `[FOLLOW-UP]`）。

## 九、红线

- 不删 next.js-agent-rules 自动块；不删中文回复金训；不删 commit-msg hook 直引节。
- 不在 AGENTS.md 之外引入新硬门——所有「硬约束」必须在 docs/anti-patterns.md 或被 AGENTS.md 内联。
- 不动 src/、tests/、components/、lib/、app/、db/、public/、scripts/、.omo/plans/*（除本 plan 自指）。
- 不动 .codex/、.git/、reports/、data/、tests/qa/。
- 不 push；不 --no-verify；不 git add . / -A；逐文件 add。