# Plan: CI 构建产物上传因隐藏目录被排除而失败（ci-artifact-hidden-files）

- 日期：2026-09-13
- 状态：已实现（8e08814 2026-09-13 ci: include-hidden-files 修复与计划同一提交落地；状态线 2026-09-26 按 git 实况修正）
- 触发：`ci: pnpm 版本以 packageManager 字段为唯一真源`（42569b4）push 后，
  lint/test/typecheck 三 job 转绿，Build job 新报错。

## 1. 现象

`pnpm build` 本身成功（✓ Compiled · ✓ 7/7 static pages · 路由表齐全），
紧接着 `actions/upload-artifact@v4` 报：

```
##[error]No files were found with the provided path: .next. No artifacts will be uploaded.
```

## 2. 根因（外部证据核实）

upload-artifact v4.4.0 起，出于安全默认排除隐藏文件（basename 以 `.` 开头）。
`.next` 是点首隐藏目录 → 整树搜索结果为空 → `if-no-files-found: error` 硬失败。

外部证据：
- actions/upload-artifact issue #610（`.output` 目录同病，解法 `include-hidden-files: true`）
- StackOverflow 79405485（Next.js `.next/` 同病）
- 本次 CI 日志 inputs 显示 `include-hidden-files: false`，证明 runner 上 v4 支持
  该入参（>= 4.4.0）。

本地不可复现：本地无 upload 步骤，`.next` 产物完好（BUILD_ID/build/cache 俱在）。

## 3. 修法

Build job 的 upload-artifact 步骤加 `include-hidden-files: true`。
visual-qa job 的 upload（path=${RUNNER_TEMP}/visual-qa）非隐藏目录，不动。

## 4. 验收标准

- AC1: ci.yml 仅 build upload 步骤新增该入参，diff ≤ 2 行
- AC2: 六层门禁本地全绿
- AC3: push 后 main CI 五 job 全绿（含 Visual QA）

## 5. 边界

- 不改 distDir（改名避隐藏是本末倒置，且动产品配置）
- 不动 Dependabot PR（npm 大版本升级 #6/#7 需单独评估，不盲并）
