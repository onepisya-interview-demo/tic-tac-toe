# Commands

> 来源：AGENTS.md §命令（行 159–170）

## 基础命令

```sh
pnpm dev
pnpm build && pnpm start
pnpm test
pnpm typecheck && pnpm lint
pnpm test:coverage
pnpm test:mutation
node tests/qa/visual-qa.mjs
```

## 端口约定

- **dev 默认端口**：`:3000`（Next.js 16 默认）
- **QA 探针端口**：`:3101`（hermetic 库）
- **dev EMFILE 止血**：见 [docs/anti-patterns.md §L2-5](./anti-patterns.md)（`WATCHPACK_POLLING=true pnpm dev`）

## 浏览器探针启动范式

探针通常用 `:3101` hermetic 库：

```sh
DATABASE_URL=file:/tmp/ulw-og2v/<unique>.db PORT=3101 pnpm start &
BASE_URL=http://localhost:3101 node tests/qa/one-identity-qa.mjs
```

**不要**对 dev server 跑浏览器 QA（生产构建是契约要求，详见 [docs/anti-patterns.md §L0-8](./anti-patterns.md)）。

## 验证六层

每 commit 必跑：

1. `pnpm vitest run`
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm build`
5. `node tests/qa/commit-audit.mjs --branch main`（0 violations）
6. 触及浏览器界面时跑 `tests/qa/*.mjs` 探针

on-demand 三层（coverage / mutation / property-based）按改动 scope 触发；触发规则、thresholds、Tested trailer 模板、engines.node 三环境对齐契约，全部以 [docs/verification-gauntlet.md](./verification-gauntlet.md) 为 single source of truth。

## 提交策略速查

```sh
git commit -m "<type>(<scope>): <subject>"  # 触发 .git/hooks/commit-msg
# 禁 --no-verify（详见 [docs/anti-patterns.md §L0-7](./anti-patterns.md)）
```

完整提交策略：subject ≤ 100 字符 / lore trailer / Plan footer / 中文正文 三例外 → [docs/commit-policy.md](./commit-policy.md)。
