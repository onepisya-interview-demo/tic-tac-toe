# Plan: ulw · CI Visual QA 弃 artifact 改自建（ulw-ci-visualqa-selfbuild-20260913）

- 日期：2026-09-13
- ulw-loop：`.omo/ulw-loop/ulw-ci-visualqa-selfbuild-20260913/`
- 前情：64ccec0（artifact 下发）在真实 runner 结构性失效，本刀替代之。

## 1. 现象（run 34766094338）

visual-qa job 1m13s 失败，服务器 30s 未起，循环报：
`ERR_MODULE_NOT_FOUND: Cannot find package '@libsql/core' imported from
.next/node_modules/@libsql/client-faf3c8e67e64747c/lib-esm/node.js`

## 2. 根因（双重实证）

- 本机结构：`.next/node_modules/@libsql/client-faf3c8e67e64747c` 为符号链接
  → `node_modules/.pnpm/@libsql+client@0.18.0/...`。Node 默认解引用解析，
  真实路径位于 .pnpm 虚拟仓，传递依赖 `@libsql/core` 于其旁命中。
- upload-artifact 不保符号链接：内容解引用落盘后，导入方真实路径变为
  `.next/node_modules/@libsql/client-*/`，向上遍历不再有 .pnpm；
  pnpm 严格布局下根 node_modules 无传递依赖 → 必然 ERR。
- 本地等价验证盲区：本地链接指本机 store 永可解析，artifact 保真问题
  无法在单机复现。

## 3. 修法

visual-qa job：
1. 删 `- uses: actions/download-artifact@v4`（-4 行，即 64ccec0 之增）
2. `pnpm install` 后增 `- run: pnpm build`（+1 行）
其余（playwright install / start / probe / upload 证据）零改动。
build job 及其 artifact 保留（人工取证），visual-qa 不再消费。

## 4. 验收标准

- AC1: diff 恰为 -4/+1，位置正确；yaml.safe_load OK
- AC2: 本地全链 `pnpm build` → `pnpm start` → probe exit 0（5 stages pass），
  证据落 /tmp
- AC3: 六门绿（audit --branch main 161/161 预期）
- AC4: 单 commit，subject 小写起，trailer 英文枚举，消息=授权件逐字节同
- AC5: 不 push
- AC6（推后）: 主公 push 后 run 五 job 全绿

## 5. 边界

- 不动 npm 依赖、不动 build job、不动产品代码
- 淘汰方案写入 Directive，防后人复蹈
