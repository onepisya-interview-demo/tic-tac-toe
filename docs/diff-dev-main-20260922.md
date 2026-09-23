# dev vs main 分支差异对比报告（工单 W-DIFF）

> 调度者注记（2026-09-22）：本报告由 W-DIFF 分析席独立实测产出，基线为 dev @ `1cec0a8`；此后 dev 新增 `39acfaa`（fix(test) coverage 工具链，1 提交），对四维度结论无影响，规模数字以本报告实测为准（其已修正 plan §2.4 的较早时点数字）。
> 关联 Plan: .omo/plans/ulw-quality-hardening-opt-20260922.md

- **生成时间**： 2026-09-22
- **HEAD (dev)**: `1cec0a8ec329eb27f99837fca847c415a3d18ea1`
- **main**: `51f164c3a41c4667fd503e385f6e5f4750b83312`（2026-09-15 02:26 +0800）
- **merge-base(main, dev)**: `51f164c` —— **main 恰为分叉点**，dev 严格线性领先（measured：`git rev-parse` + `git merge-base`）
- **规模实测**： `git log --oneline main..dev | wc -l` = **121 提交**；`git diff --stat main..dev` = **170 文件，+21786 / −1905**（measured。工单背景的「116 提交 / 169 文件 / +21734」是较早时点实测，dev 此后新增 5 个 docs 提交，以本次实测为准）
- **时间跨度**： 2026-09-15 → 2026-09-22（measured：merge-base 提交日期；tip 所属 plan slug `ulw-quality-hardening-opt-20260922`）
- **结论标签**： **measured** = 命令实测；**inferred** = 由实测证据推理；**guess** = 低置信推测

## 给决策者的 TL;DR

main 停在功能重做（房间术语 + 双版本拆分）之前，dev 领先 121 提交且**可纯 fast-forward**（main 即 merge-base）。线上 3t.onepis.net 已运行 dev 行为（部署 origin/dev），main 与线上实际服务已严重脱节。差异主体是 docs（48.8%）+ feat（20.7%），含三组破坏性变更：旧 API 全家退役、DB 从单行表改 per-room 表、`/play` 路由消失。main..dev 的 20 个 fix 全部修的是 dev 新增代码自身的回归或 QA 工具链，**没有一条修 main 现存产品 bug**——真正的 main 风险面是「ResultBanner 庆祝重放」一个 bug 加上「从 main 构建会与已迁移的线上库/已部署行为不兼容」的结构性陷阱。建议将 main fast-forward 推进到 dev，最终裁决归项目所有者。

---

## 一、提交分类占比（121 提交，measured）

统计命令：`git log --format='%s' main..dev | sed -E 's/^([a-z]+)(\([^)]*\))?(!)?:.*/\1/' | sort | uniq -c | sort -rn`

| type | 数量 | 占比 | 说明 |
| --- | --- | --- | --- |
| docs | 59 | 48.8% | plan 入档 / 终验报告 / 契约文档同步 / AGENTS·README 维护 |
| feat | 25 | 20.7% | 全列见下 |
| fix | 20 | 16.5% | 全列见维度三 |
| refactor | 8 | 6.6% | 见下 |
| test | 6 | 5.0% | 全部为 QA 探针 / store 回归 |
| chore | 3 | 2.5% | 含 1 个 merge 提交 |

（占比合计 100.1% 为四舍五入误差。提交消息均符合 Conventional Commits，无 `!` 破坏性标注、无 BREAKING CHANGE footer——`git log main..dev --grep='BREAKING'` 零命中，measured；破坏性语义体现在正文中，见维度四。）

### feat 全列（25 条）

| sha | 主题 |
| --- | --- |
| `2b79d14` | 新增 /solo 单机模式路由 + 首页双 CTA |
| `4f5ec71` | 引入 ranked/solo 模式，solo 本地累加 + localStorage 持久化 |
| `0bab68e` | View Transitions 双向 crossfade CSS 底座 |
| `f45ddbf` | 四页接线 React 19 `<ViewTransition>` |
| `813e0ac` | 三页 header 移动端单行化 |
| `fbbc34c` | solo 结果去重 + 顶栏切换视图 + 切换动效 |
| `c619df6` | solo_records 按名同步数据层（中间态，后退役） |
| `894dffe` | 玩家名输入与 solo 战绩网络同步（中间态） |
| `569b80d` | 存名 PUT /api/solo-stats + PlayerNameForm（中间态，已退役） |
| `a9973b2` | 合并战绩接口 + 服务端 per-field 累加 |
| `700a388` | 合并确认弹框 + 同步流程接入面板 |
| `f419848` | 玩家名输入响应式 + n/24 计数（中间态） |
| `1cbcdde` | 同步哨兵 + 探针 + merge-sync-qa |
| `66fdb01` | solo 纯本地化——删具名 auto-POST + 首页起战拦截弹框 |
| `d9ad855` | 单表模型 + name 注册/登录端点（solo_records 退役；中间态） |
| `d3471bb` | solo 页纯净化——撤 name/同步/GET 全部网络面 |
| `161d7cb` | 首页身份区 + 回首页同步弹框（PUT 存名退役） |
| `860a4dc` | result 体验页内化——胜平自动切战绩视图 + 再来一局 |
| `a0055e5` | 身份区编辑态折叠（中间态，W3 随身份区退役） |
| `1fcc41e` | RESTful 四端点 + RFC 9457 problem+json + game-net 重接 |
| `c9ef27f` | 展示页 landing 化 + online 入口拦截 + /result RSC + JSON-LD |
| `c75cfdf` | 客户端一波迁移——首页重做 + RoomGateDialog + 概念零残留 |
| `1c3899e` | /result 胜利庆祝恢复——哨兵门控 confetti 岛 |
| `2d8f8d4` | /online 直达门控——页内 identity bootstrap + 无名收名 |
| `9fe08aa` | 在线房间战绩清空——/result 分支挂确认弹框清零 |

### refactor（8 条全列，承载 API/schema 迁移主线）

`7586e82`（服务端 name→room 一波迁移：API family / DB 列 / 测试面）、`7765b3f`（**/api/stats 链退役** + mode online\|offline 平移）、`d07fd07`（**solo/ranked 语义清退：app/play→app/online、app/solo→app/offline 全链正名**）、`5fe93c0`（problem slug 去 player 化，无兼容期）、`c65d876`（抽取 GameShell）、`bb171bf`（抽取 ui/BoardGrid）、`866fbf5`（首页按钮响应式纵排）、`17803d0`（删「结果：O 胜」副行 + lastOutcome 字段连根）。

### test / chore 代表

test：`e6bd762`（探针半区 W3 迁移——room + HomeStatsEntry + /result?room= 强断言）、`0483513`（匿名首局官方探针，/offline 全链路零 API）、`40eec4a`（跨模式与隐私模式 store 回归）、`07f9cc6`、`daf6a4c`、`66e7a1c`。chore：`2321f04`（并入波 B 同步语义重建，本区间唯一 merge 提交）、`aebd837`（f 账清偿 + 截图重制）、`bece476`（gitignore 排除 .zcode）。

### docs 代表（59 条选代表）

`11e13b9`（ulw-one-game-two-versions plan 入档，双版本总纲）、`82c65e9`（ulw-room-migration-home-landing plan）、`4b71391`（CONTEXT.md 仓库术语库入档）、`0af3b21`（房间术语 + 首页引导化文档一波迁移）、`d6eccd3`（双版本叙事 + RESTful API 参考 + 词汇语义）、`471967b` + `5e75ecd`（dev EMFILE 已知问题与 HMR 放大器入档）、`022b9ee`（视觉判定修订——多模态读图 + 探针即验证）、`1cec0a8`（tip：质量加固波 plan 状态翻转 executing）。

---

## 二、用户可见行为变化清单（面向 3t.onepis.net 最终用户）

### 2.1 路由变化（measured：`git ls-tree -r --name-only {main,dev} -- app/ | grep -E 'page|route'`）

| main | dev | 证据 |
| --- | --- | --- |
| `/play`（双人页） | **`/online`**（rename R095） | `d07fd07` |
| （无） | `/offline`（经 `/solo` 中间态，rename R086） | `2b79d14` 新增 /solo → `d07fd07` 更名 |
| `/result`（本局结束页） | `/result` 重做为 RSC 实时成绩单，按 `?room=` 查询 | `c9ef27f`、`7586e82` |
| `/`（战绩卡 + 单 CTA） | `/` 改为引导页（hero + 玩法引导 + 双 CTA + 战绩静态入口） | `c9ef27f`、`c75cfdf` |

- 旧链接 `/play` 在 dev 下 **404**（该路径已无 page 文件，measured；未发现任何 redirect/rewrite 配置——`next.config` 层未验证，404 判定为 inferred）。
- 演进链（measured，`git show --name-status d07fd07`）：`/play` 存活到 `d07fd07` 才 rename 为 `/online`；中间态为 `/play` + `/solo` 双页。

### 2.2 功能新增

| 行为 | 证据 sha | 说明 |
| --- | --- | --- |
| 双模式拆分：offline 纯本地（零网络写）/ online 实时上服 | `4f5ec71`→`7765b3f`→`d07fd07` | 模式概念 ranked/solo → online/offline 三段演进 |
| 房间收名（RoomGateDialog）：首页 online CTA 无名拦截弹框、n/24 计数 | `c9ef27f`（入口拦截）、`c75cfdf`（弹框） | 「房间」= 战绩账本标识 |
| /online 直达门控：无名页内就地开弹框，拒绝静默无名对局 | `2d8f8d4` | onReject 有意不关弹框 |
| 身份持久化：刷新后房间名自 localStorage 恢复（identity bootstrap） | `cace8f4`、`2d8f8d4` | 修补删 PlayerNameForm 后的反向 hydration 缺口 |
| 跨设备战绩合并：首页合并弹框（用户确认才发，服务端 per-field 累加，合并后本地清零） | `700a388`、`a9973b2`、`66fdb01`、`161d7cb` | 同步哨兵防 double-count（`1cbcdde`） |
| /result 胜利庆祝 confetti（仅胜局、哨兵门控一次性消费） | `1c3899e` | 平局零庆祝 |
| 在线房间战绩清零（/result 内确认弹框 → reset 端点） | `9fe08aa` | 清零计数、保留房间身份 |
| 页面过渡动画（React 19 View Transitions crossfade） | `0bab68e`、`f45ddbf` | |
| SEO：JSON-LD 结构化数据 + 展示页 landing 化 | `c9ef27f` | |
| 移动端三页 header 单行化 + 一屏收紧 + sticky header | `813e0ac`、`4caae91` | |
| offline 匿名也可记账（本机账本无条件直显，匿名卡退役） | `67e0ab6`、`a68f5be`、`3e4dba6` | |

已知边界（dev 现役，inferred 自 AGENTS.md V11 记录）：有名直达 /online 不触发建档，若服务端无该 room 行，胜局 outcomes 404 零记账但导航照常（/result 显示空账本）——有意为之，留未来波裁决。

### 2.3 API 面变化（measured：两端点文件树对照）

**退役**（dev 树已无文件，`7765b3f` 删除）：
- `GET/PUT/DELETE /api/stats`、`POST /api/stats/outcome`（main 的全部 API 面，measured：`git show main:app/api/stats/route.ts` 导出 GET/PUT/DELETE）

**中间态生灭**（存在于 dev 历史但现网均已退役）：`PUT /api/solo-stats`（`569b80d` 生，`161d7cb` 退役）、`/api/players/*` 注册/登录/合并族（`d9ad855` 生，`7586e82` name→room 一波迁移）。

**现役**（dev）：
| 端点 | 证据 |
| --- | --- |
| `POST /api/rooms`（进入房间，幂等 `{stats,existed}`，422） | `1fcc41e`、`7586e82` |
| `GET /api/rooms/[room]/stats`（404 problem+json） | 同上 |
| `POST /api/rooms/[room]/stats/merge`（409 enter-room-required 防静默建档） | `a9973b2`→`1fcc41e`→`7586e82` |
| `POST /api/rooms/[room]/stats/outcomes`（404 stats-not-found） | 同上 |
| `POST /api/rooms/[room]/stats/reset`（404 防静默建档） | `9fe08aa` |

错误契约统一为 RFC 9457 problem+json（`1fcc41e`，lib/api-problem.ts）。注意现役端点是 **5 个** route 文件，AGENTS.md 摘要写「四端点」未含 reset（`9fe08aa` 新增，58eb271 才补 digest）。

### 2.4 文案 / 视觉

- 「玩家名 / 注册 / 登录」概念整链清退 → 「房间」术语（`0af3b21` 文档、`5fe93c0` slug 去 player 化无兼容期、`3e4dba6` 词汇表逐字落地）。
- /offline 匿名提示卡退役，账本无条件直显（`a68f5be`、`3e4dba6`）。
- 重置按钮文案对齐 + 作用域标注（「仅清零双人公共战绩…」）（`52ce8f7`、`26d17dd`；后随 W3 迁移演化为 ResetRoomStatsButton）。
- social card / 截图多轮重制（`9e2d2b8`、`02c654d`、`31d56f6`、`aebd837`）。
- 删「结果：O 胜」副行（`17803d0`）。
- main 的 Confetti 组件经 `SoloConfetti`→`WinConfetti` 演进（`3251cf7`、`d07fd07` R087）。

### 2.5 存储与数据形态（用户不可见但影响行为）

- localStorage：main 无战绩本地持久化（SSR StatsHydrator 直灌）；dev 增加 offline 本地账本 key `ttt.offline.*` + 房间名 `ttt.room.name.v1`（`4f5ec71`、`c75cfdf`）。旧 `ttt.player.name.v1` 启动期单向清除不迁移（`cace8f4`，measured 自 AGENTS.md + cace8f4 正文）。
- DB schema：main 单行表 `game_stats (id=1)` 无身份列 → dev per-room 单行族 `room TEXT UNIQUE`（`git show {main,dev}:db/schema.ts` 对照，measured）。中间历经 solo_records 表（`c619df6` 生、`d9ad855` 退役）与 name 列（`d9ad855`→`7586e82` 改名）。

---

## 三、main 缺失的 bug 修复清单（风险面）

fix 共 20 条全列。**核心结论（measured）**：逐条对照 main 文件树（`git ls-tree main -- components/ lib/ app/`）——这些 fix 的病灶文件（PlayerNameForm、OnlineStatsCard、RoomGateMount/Dialog、ResultNavigator、SoloConfetti、app/solo、stats-race 探针等）**均不存在于 main**，20 条 fix 没有一条修「main 上已存在的产品 bug」；它们修的是 dev 六个波次新增代码自身的回归、DB 基建与 QA 工具链。

### 3.1 产品行为 fix（12 条，均为 dev 自引入回归，main 不存在该 bug）

| sha | 主题 | 一句影响 |
| --- | --- | --- |
| `6b53402` | /result 再来一局死循环 | 修「纯 Link 零清理 + store 单例残留终局态 + 自动导航」四步链死循环；main 的同位置按钮带 `onClick={startGame}` 主动重置（measured：`git show main:components/ResultActions.tsx` line 26），无此 bug |
| `e15e049` | /result 自动导航等待记局写落定 | 修在线完局后成绩单首屏延迟一拍（UPSERT 未落库 RSC 已直读） |
| `cace8f4` | room-gate-mount 挂载期 identity bootstrap | 修删 PlayerNameForm 后刷新丢名、首页战绩入口不渲染 |
| `67e0ab6` | offline 分支摘掉 isAnonymous 早退 | 匿名用户落子原本不记账 |
| `a68f5be` | 删 OfflineStatsPanel 匿名态分支 | 匿名态空卡占位退役，账本直显 |
| `3251cf7` | bug b + bug c + restart 条件化 | 修彩纸重复触发 / 状态条布局 / 非棋盘视图误显 restart |
| `f9f4074` | solo 契约加固（白名单/守卫/mode 错配） | store 跨模式与异常输入防护 |
| `26d17dd` | /result 重置文案对齐 + DESIGN 补完 | 文案一致性 fix |
| `52ce8f7` | 线上卡刷新链路激活 | 合并后线上卡不自动刷新；重置按钮作用域标注 |
| `61a0ce0` | 弹框居中 + backdrop 契约 + 删调试文案 | 视觉合规 fix |
| `4caae91` | 一屏收紧 + sticky header | 修 375×667 下 /solo 溢出 19px；病灶在 dev 新增页面与 GameShell（main 无此组件，measured） |
| `b49968a` | 分离 doc 笔误 + 孤儿退役 + e2e 断言 | V7 评审清账 |

### 3.2 DB 基建 fix（2 条，dev 自身 schema 演进的产物）

| sha | 主题 | 一句影响 |
| --- | --- | --- |
| `9d0bfb6` | getDb 启动自愈迁移 | 修「schema 加列后存量库 `no such column` 起服 500」——补列探测 + 事务重建 + solo_records 退役 |
| `3a15f5a` | reconcile 补半成品状态探测 | 修「列在但 UNIQUE 缺」的半迁移库永久脱管 + updated_at 保留回归守卫 |

注：main 的 `lib/db.ts` **无任何 reconcile/迁移逻辑**（measured：grep pragma/ALTER/DROP 零命中，仅固定 `STATS_ROW_ID = 1` 读写）。这意味着反向不成立——main 不是「缺这两个 fix」，而是「缺整个自愈机制」；若 main 未来再动 schema 会重蹈 9d0bfb6 之前的事故形态（inferred）。

### 3.3 QA 工具链 fix（6 条，不影响产品运行时）

`92e1778`（ux-qa win-glow 时序断言）、`f6b5717` / `b9dbc37` / `6cff53a` / `a8a7063`（stats-race 探针四轮修级 + CI 加 job）、`7c29d62`（hydration-check 轮询等待）。这些修的是探针自身的竞态/度量失真；main 缺它们只意味着 main 跑不了这些 QA 门禁，产品行为无差。

### 3.4 main 上仍然存在的 bug（「从 main 构建」的真实风险面）

1. **/result 胜利庆祝重放**——main 的 ResultBanner 直读 store（`git show main:components/ResultBanner.tsx`：`{phase === 'won' ? <Confetti /> : null}`，measured）且无任何消费哨兵；软导航下 store 单例跨路由保留 won，用户胜局后**每次软导航重访 /result 都重放彩纸**。dev 已以哨兵契约修复（`1c3899e`，ResultCelebration 读后即清）。这是 main..dev 中唯一一个「修的是 main 现存行为」的对应项（inferred：基于 main 代码直读 + 1c3899e 正文对旧边界的点名；未在 main 构建上实测重放）。
2. **结构性陷阱（比 bug 更重要）**：若今天从 main 构建并连上现网 Turso 库——库已被 dev 代码迁移为 per-room 形态（`room TEXT UNIQUE` 多行）——main 代码按单行 `id=1` 读写（measured：main lib/db.ts `STATS_ROW_ID`），读到的是第一行房间的脏数据、写入会错账（inferred：结构推断，未实测）。反过来，dev 代码连上 main 形态 legacy 库会按 D-4 决议 **DROP 重建、清空数据**（measured：`git show dev:lib/db.ts` DROP TABLE game_stats/solo_records + `d14bae0` D-4「数据可清空从头来过」御定许可）。**两个方向的库/代码组合都不兼容**，这是 main..dev 最硬的破坏性变更。

---

## 四、发布建议

**建议：将 main fast-forward 推进到 dev（`git checkout main && git merge --ff-only dev`），最终裁决归项目所有者。**

可行性（measured）：main (51f164c) == merge-base，dev 严格领先，`--ff-only` 零冲突零合并提交。

**利**：线上 3t.onepis.net 当前部署 origin/dev（背景给定），main 推进后「从 main 构建」才与线上实际行为一致——否则 main 是一个会连坏库、读脏账、404 旧 API 的陷阱版本，任何基于 main 的回滚/复刻都会产生与现网分叉的第二真相。

**弊**：main 一次性吸收全部破坏性变更，没有任何渐进切点——旧 API 消费者（若有外部脚本依赖 `GET/PUT/DELETE /api/stats`、`POST /api/stats/outcome`）与收藏了 `/play` 的用户直接断裂；且 dev 首次连接旧形态库即清空数据（D-4 御定许可，`d14bae0`），合并本身不触发，但任何「main 构建接 dev 库」或「dev 部署接旧库」的错配都会立即体现为数据清空/脏读。

**破坏性变更核对表**（供所有者裁决，全部 measured 除注明外）：
1. API 端点退役：`/api/stats`、`/api/stats/outcome` 全系消失（`7765b3f`），problem slug 无兼容期直换（`5fe93c0`）；
2. schema 分叉：单行表 → per-room `room TEXT UNIQUE`，无数据迁移、D-4 清空许可（`d14bae0`、dev lib/db.ts DROP rebuild）；
3. 路由：`/play`、中间态 `/solo`/`/ranked` 全部消失且无 redirect（`d07fd07`；404 行为 inferred）；
4. localStorage：旧 key 单向清除不迁移（`cace8f4`）。

**若所有者选择保持 main 不动**：后果是 main 继续作为「功能重做前的快照」存在，风险可控（仓库无外部 fork 证据，inferred），但建议至少在 main README 或分支说明上标注「非线上形态，禁止接现网库」，消除误构建风险。

**残留未验证项**（如实声明）：本报告全程只读，未执行构建/启动/浏览器探针；「/play 404」「main 接 dev 库脏读」为代码结构推断；线上部署状态（origin/dev）采信工单背景未独立核实。若需实测背书，建议所有者裁决合并前跑一轮 `pnpm build` + tests/qa 探针（dev 形态、hermetic 库）。

---

*报告完。生成：W-DIFF 分析席，2026-09-22，基线 HEAD `1cec0a8`；全程零文件修改，仅只读 git 命令（rev-parse / merge-base / log / ls-tree / show / diff --stat / grep）。*
