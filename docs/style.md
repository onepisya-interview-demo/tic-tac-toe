# Project Style

> 来源：AGENTS.md §项目特有风格（行 149–157）

## 视觉与交互

- 桌面优先的暗色 UI；移动端保持可用，但不是优化目标。
- 音效默认静音，本地持久化，并在用户手势后懒创建 AudioContext。
- 所有装饰性动效都有 `prefers-reduced-motion` 下的无动效路径。
- 稳定的 `data-testid` 节点是 QA 契约，包括不接收交互的彩纸层。
- 胜局探针使用 `0,3,1,4,2`，保证随机先手总能赢上排。

## 路由命名（schema.org 词汇表对齐）

- 路由命名遵循 `offline` / `online`（schema.org 词汇表对齐）；不引入 `solo` / `ranked` / `singleplayer` / `multiplayer`。
- 「房间」是这台设备上这组人的战绩账本标识（pass-and-play 同设备对战语义）。

## W3 D-3 房间术语迁移

W3 D-3 一步到位迁移：API 路径 `/api/rooms/*`、DB 列 `room TEXT UNIQUE`、localStorage key `ttt.room.name.v1`、代码符号 `roomName` / `RoomGateDialog` / `RoomGateMount` / `HomeStatsEntry`。

旧 `ttt.player.name.v1` 启动期被 `cleanupLegacyPlayerNameKey` 单向清除，不迁移；旧 `PlayerNameForm` / `OnlineStatsCard` / `/api/sessions` / `/api/players/{name}/stats*` 整体退役。

**术语红线**：用户可见文案零「玩家名 / 注册 / 登录」作为现役概念，详见 [`.omo/plans/ulw-room-migration-home-landing.md`](../.omo/plans/ulw-room-migration-home-landing.md) §1 + [`CONTEXT.md`](../CONTEXT.md)。

## 交叉引用

- 设计令牌 → `app/globals.css` + `DESIGN.md`
- 视觉契约 → [docs/anti-patterns.md §L1-3 (div onClick/emoji/组件级 focus ring/第二水合触发点)](./anti-patterns.md)
