# 交接报告：两计划五票波（执行 2026-09-25 → 交接 2026-09-26）

> 性质：移交主公核对与决策。票源：[ulw-sync-dialog-identity-lock-20260924.md](plans/ulw-sync-dialog-identity-lock-20260924.md)（T-M1）+ [ulw-room-lifecycle-20260924.md](plans/ulw-room-lifecycle-20260924.md)（T-N1..N4 + 收口）。执行波 dwfrun-926d642f（herdr codex × 5 席 + 合流执行员 + 独立终验 + 换人复核返工闭环）。
> 主公三项核对结论已逐条对照现查证据：① 一致；② 定点一致但**升级出决策项 Q3**；③ 「未 push」一致、**数字修正为 ahead 8**（见 §三）。

---

## 一、交付总览（commit 链，时间戳为证）

dev @ `f756129`，origin/dev 未动（未 push）。`git log --format='%h %ci %s' origin/dev..dev` 现查：

| commit | 时间（2026-09-25） | 交付 |
|---|---|---|
| `818ea02` | 18:05 | 两份计划入档（派发基线） |
| `d685cf6` | 21:00 | T-M1 合并弹框身份锁定 + 首次收名回写（BR-11） |
| `0817519` | 21:18 | T-N1 服务端 DELETE 销户端点 + room-not-found slug |
| `c5aac38` | 21:23 | T-N3 TTL 三十天自动回收（维护端点 + Vercel Cron） |
| `86202f9` | 22:14 | T-N2 结果页退出/删除双入口 |
| `80c21cf` | 22:23 | 收口 rooms-race step 9 + BR-12 + CONTEXT.md 三分术语 |
| `cdacf88` | 22:52 | 返工① R6 双向绑定回绿（BR-6 头注） |
| `f756129` | 22:57 | 返工② T-N4 提交确认文案补票 |

## 二、门禁与探针台账（2026-09-26 现查证据）

- **vitest**：540 passed | 11 skipped（551）——基线 505+8，本波净增 35 通过 + 3 skip（`pnpm vitest run` 现跑）。
- **typecheck / lint**：每波合流后 + 终验均 exit 0（脚本亲自跑，非席位自报）。
- **build**：终验 exit 0；**commit-audit `--branch dev`**：0 violations（含 R6 BR↔探针双向绑定）。
- **红线断言**：`git diff 818ea02..HEAD -- tests/qa/commit-audit.mjs commitlint.config.cjs .github` 空输出。
- **探针（生产构建，端口 3117，file:/tmp 本地库）**：home-return-qa（含新 step 10/11）/ rooms-race-qa（含新 step 9）/ one-identity-qa 全 PASS——独立终验员执行（未读执行席报告）。
- **BR 落位**：`docs/business-rules.md:21`（BR-11 → home-return-qa step 10 有身份只读 + step 11 无身份回写）；`:22`（BR-12 → rooms-race step 9 真 API DELETE + step 5 直连 DB 双通道互补）。探针头 R6 绑定：`tests/qa/home-return-qa.mjs:3` 含 `BR-11`；`tests/qa/rooms-race-qa.mjs:3` 含 `BR-12`。
- **鉴权实现**：`app/api/maintenance/purge/route.ts:38-42` Bearer 校验 + 常量时间比较；`vercel.json` crons `0 3 * * *` → `/api/maintenance/purge` 已注册入 commit。
- 注：当前工作树 `next-env.d.ts` 显示 M——dev/build 变体翻转生成噪声，非人为改动，`next dev` 会翻回。

## 三、主公三项核对 × 调度者现查对照

**① CRON_SECRET 零泄漏——一致，证据链补全：**
- `git grep -n CRON_SECRET` 全量命中均为变量名 / `${CRON_SECRET}` 占位符 / 操作说明（plan、README.md:90、route.ts 注释、operations.md、测试注释）。
- 负对照（无引号版）`CRON_SECRET\s*=` 唯一命中 `docs/operations.md:261`——是 shell 提取管道（运行时从 .env.local 读值 `cut -d= -f2-`），非入仓赋值；主公的带引号负对照零命中成立。
- 被跟踪 env 仅 `.env.example`；`.gitignore:45-50,129` 全覆盖 `.env*`。
- 测试假值 `tests/api/maintenance-purge.test.ts:51`（`SECRET = 'test-cron-secret-aaaaaaaaaaaaaaaa'`），`:54` beforeEach 注入、`:60` afterEach 删除，不入真值。

**② TTL 定点——一致，但暴露文档-实现矛盾，升级为 Q3：**
- 定点确认：`lib/db.ts:678-679` `purgeStaleRooms(maxAgeDays = 30)`；`app/api/maintenance/purge/route.ts:64`（POST）与 `:75`（GET）均**显式传 30**。
- 矛盾：`docs/operations.md:274-276` 声明「改默认值仅改 `purgeStaleRooms` 默认参数一处——所有调用方以默认值落地」。**当前端点显式传参，改默认值不生效**——「改一处」承诺不成立（详见 Q3）。

**③ push——结论一致（未 push），数字修正：**
- 现查 `git status -sb` → `ahead 8`；主公「ahead 6」快照恰好落在 09-25 **22:23–22:52 返工窗口**内（80c21cf 合入之后、cdacf88/f756129 落地之前）。八条 commit 时间戳连续完整，无丢失、无漂移、无外部改动。
- 数数口径：8 = 基线 818ea02 + 五票/收口 5 笔 + 返工 2 笔。

## 四、意外与处置留档

1. **t-n4 席整计划漂移**：席把 `$omo:start-work`（多票计划）解读为执行整份计划，自行派五票。司机 pane 取证判 drift、拒绝合流；T-N4 由返工席在 dev 直修交付（`f756129`）。受阻分支 `ulw/t-n4`（@ f8f2480）**保留备查**，worktree 已拆，内容已被各席等价覆盖（处置见 Q5）。
2. **t-m1 首派席 codex parser 故障**（全部工具调用参数解析错误）：整席重建 fresh 重派一次过，worktree 隔离零污染。
3. **R6 基线隐性违规**：`commit-audit --branch dev` 全仓校验揪出 BR-6 探针文件头 20 行缺 BR-6 引用（非本波引入）——返工 `cdacf88` 当场修复。
4. **t-n13 白名单裁量**：`lib/api-problem.ts` 超 brief 字面白名单，系票面「room-not-found / unauthorized slug 最小新增」的必然载体——司机独立 diff 取证后放行并留档。

## 五、待主公决策清单（批注后转已决入档）

**Q1 push 时点**
- 事实：dev ahead 8 全绿（§二台账），本地领先越久与后续改动冲突风险越大；Vercel Cron 确认是部署后动作，不阻塞 push。
- 选项：a) 现在push；b) 等 CRON_SECRET 配好、部署验证后一起推。
- 利弊：a) 及早释放远端 CI 背书，避免后续票基线漂移；b) 单次部署含全部改动但拖长本地领先窗口。
- 建议：**a) 现在 push**。

**Q2 CRON_SECRET 生成与配置**
- 事实：端点已按 `Authorization: Bearer ${CRON_SECRET}` 落地；值需进 Vercel 环境变量（调度者无 Vercel 凭据，Dashboard 操作属主公亲手项）。
- 选项：a) 主公 `openssl rand -hex 32` 自生成，配 Vercel（Production 必需；本地 `.env.local` 建议同步一份以启用 operations.md:258-262 手动 curl 通道）；b) 只配 Vercel、本地用临时 env。
- 利弊：a) 手动通道随时可用；b) 本地少存一份秘密。
- 建议：**a)**（demo 库语境，本地留存可接受）。

**Q3 TTL 调整通道修复（本报告新发现，需裁决）**
- 事实：operations.md:274-276 承诺「改一处」，但 route.ts:64/75 显式传 30，改默认参数实际不生效。
- 选项：a) 删端点两处显式实参（2 行改动，恢复「改一处即全局生效」，兑现计划裁决「主公可改一个常数」）；b) 保留显式传参、改 operations.md 为「改三处」。
- 利弊：a) 兑现原裁决、运维心智最简；b) 零代码改动但文档退化为三处同步。
- 建议：**a)**——单票可并入下波或作为本波补丁（等主公定）。

**Q4 TTL = 30 天维持确认**
- 事实：现值 30 天（`updated_at` 严格小于 cutoff 删、等于不删，边界有测试锁定）。
- 建议：**维持**；改则随 Q3 一并落地。

**Q5 `ulw/t-n4` 受阻分支处置**
- 事实：分支内容是 t-n4 席跑偏产物（五票全跑版），已被 dev 各席等价覆盖；worktree 已拆，分支保留中。
- 选项：a) 主公验收后删除（`git branch -D ulw/t-n4`）；b) 长期保留备查。
- 建议：**a)**——验收通过即删，留档价值已由本报告 §四 与执行报告覆盖。

**Q6 验收结论与稳定 tag**
- 事实：按 09-22/09-23 惯例，主公手动验收「未发现业务不符合」后令打 `dev-stable-*` annotated tag（只留本地，消息含覆盖范围 + 门禁数字 + 验收结论）。
- 建议：主公完成业务语义抽查（§六清单）后给验收结论；tag 由主公下令、调度者代打或主公亲手均可（按先例主公亲手）。

## 六、想法统一区（已落地语义，请主公确认对齐）

1. **三分语义**（CONTEXT.md 已入册）：清空 reset-room-stats（保留身份）／退出 leave-room（清本地身份+战绩，**零网络写**，服务端账本保留给其他设备）／删除 delete-room（服务端+本地全清，**唯一销户通道**）。
2. **删除自愈路径**：删除后同名 `POST /api/rooms` 幂等重建**全零新账本**（不复活旧数据）；另一设备视角 404 + OutcomeErrorBanner 现役链路承接——损害封顶为账本清零。
3. **TTL 口径**：30 天不活跃（`updated_at` 严格小于 cutoff，等于不删）；凌晨 3 点 UTC 每日一次。
4. **身份锁定边界**：有身份弹框只读、首次收名成功回写 localStorage；「改名=换账本（旧账不迁移）」语义不变，未引入改名功能（B 案否决理由留档于计划 §五）。

任一条与主公理解不一致 → 文字批注指出，调度者出修订票，不擅自改语义。

## 七、建议节奏

push（Q1）→ 配 secret（Q2）→ 部署 → Vercel Dashboard 确认 Cron 注册与首跑（operations.md:238-244 注记）→ 主公验收（§六）→ Q3/Q4/Q5 批注 → tag 指令（Q6）→ 调度者收尾（分支清理、批注转已决入档、/tmp 席位现场清扫）。
