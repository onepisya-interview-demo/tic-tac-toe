# lib/ 代理说明

核心边界：纯游戏规则、客户端状态编排、浏览器效果和服务器 SQLite 持久化。

## 查找入口

| 任务 | 位置 | 边界 |
| --- | --- | --- |
| 棋盘、胜负、落子、战绩计算 | game.ts | 纯函数；不用 React、DOM、网络或数据库 |
| 局面生命周期和 API 同步 | store.ts | 客户端单例；本地 UI 状态优先，stats PUT 尽力而为 |
| solo 模式浏览器持久化 | solo-stats.ts | load/persist/clear；window 守卫 + shape 校验（非法即 emptyStats） |
| 读取、写入、重置战绩 | db.ts | 仅服务器；@libsql/client + Drizzle（file:/http(s): 自适应） |
| 行形状 | ../db/schema.ts | game_stats 有意保持单行 id=1 |
| 音效程序和静音状态 | sound.ts | 浏览器 Web Audio；懒创建 context；默认静音 |
| 庆祝粒子 | confetti.ts | 浏览器 canvas-confetti；尊重 reduced motion |

## 契约

- applyMove 对越界或已占用格子抛错；store 的守卫让这些路径不会触发。
- GameStats.currentStreak 有符号：X 为正，O 为负，平局后归零。
- stats GET 失败时 startGame 仍开始；PUT 失败时本地 won/drawn 结果仍保留。
- 浏览器 store 模块加载时只水合战绩一次；页面不要再加第二个 GET kickoff。
- db.ts 创建父目录/表（file: 分支），异步 open / bootstrap / 缓存连接；http(s) 分支不经 fs，直接连 Turso。closeDb 异步关闭，供测试使用。
- 音效默认静音，并持久化为 ttt.sound.muted；playSound 每次播放前重新检查静音。
- 桌面彩纸从 x 0.18/0.82、y 0.55 发射；小于 1280px 用两边缘；reduced motion 时 no-op。

## 测试说明

- game/store/db 是 Stryker mutation targets；分支必须对应可观察行为。
- game.ts 有单元和 fast-check 覆盖；store 测试 mock /api/stats；db 测试使用临时数据库。
- streakLabel 这类派生 UI 标签放在这里，让多个路由和测试共享一份实现。
- 音效/彩纸测试 stub 浏览器全局和 timers；不要求真实音频或视觉粒子。

## 反模式

- game.ts 不导入 React/DOM；客户端不导入 db.ts。
- 不新增第二个持久化触发点，不让 schema 分叉，也不在 db.ts 外写 raw SQL。
- 不提前创建 AudioContext，也不把默认值改成有声。
- 不引入动画库；纯规则里不留下未解析副作用。
