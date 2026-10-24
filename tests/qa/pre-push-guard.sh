#!/bin/sh
# pre-push guard — 主公 push 法令 2026-10-24：「永不自动 push」
# 真源：tests/qa/pre-push-guard.sh（本文件）；.git/hooks/pre-push 为同内容安装副本
# （git 不跟踪 .git/ 内文件，克隆/重建后按下一行重装）。
# 安装：cp tests/qa/pre-push-guard.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push
#
# 判定（顺序定死）：
#   1. stdin 或 stdout 是 TTY → exit 0：主公本人终端操作，无感放行；
#   2. MASTER_PUSH_DECREE=1 → exit 0：主公明令后带令牌执行的单次授权；
#   3. 其余（AI 子进程/GUI/CI 等非交互）→ stderr 拦截说明 + exit 1。

# 逃生门一：交互终端——主公本人的手，无感放行
if [ -t 0 ] || [ -t 1 ]; then
  exit 0
fi

# 逃生门二：主公明令后的单次授权令牌（仅当次命令环境注入，不落盘）
if [ "$MASTER_PUSH_DECREE" = "1" ]; then
  exit 0
fi

# 默认：非交互 push 一律拦截
cat >&2 <<'EOF'
[push-guard] 非交互 push 已被拦截
主公 push 法令 2026-10-24——AI 永不自动 push（①安全；②推上去再改还需 force push）。
已获主公明令授权时：MASTER_PUSH_DECREE=1 git push ...
GUI/非交互环境被误拦时：请主公本人在终端操作 git push（终端免令牌放行）。
EOF
exit 1
