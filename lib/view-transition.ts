/**
 * lib/view-transition.ts (ulw-modal-collision-and-error-alerts 案① a/b)
 *
 * afterViewTransition(callback) — 等当前帧的 View Transition 动画
 * (`page-fade-in` / `view-swap-in`, 见 app/globals.css @supports 块)
 * 结束再触发 callback。HomeDialogMount / OnlineGateMount 借此把
 * dialog 的 showModal() 推出 150ms / 250ms 的过渡窗口, 避免 dialog
 * + backdrop 被烘进 root 快照, 走 250ms UA 默认交叉淡化（旧实现里
 * 这条路径用户能直接看到「弹框慢慢浮现与旧页重合」）。
 *
 * 设计契约:
 *  - 浏览器探测 document.getAnimations() 一帧后是否有 page-fade-in /
 *    view-swap-in 动画；有则挂 animationend 监听；无则双 rAF 后立刻
 *    触发 callback（瞬时导航或不支持 VT 的浏览器）。
 *  - 600ms safety 上限：VT 最长 .page 150ms + root 250ms ≈ 400ms，
 *    余量 200ms 防浏览器卡顿或动画注册时序差。
 *  - SSR no-op: typeof document === 'undefined' 时立即 callback。
 *  - 一次执行：done 标志位防 callback 多次触发；cleanup 自动
 *    removeEventListener + clearTimeout。
 *  - 无第三方库依赖；L0-5 兼容。
 */

export function afterViewTransition(callback: () => void): void {
  if (typeof document === 'undefined') {
    callback();
    return;
  }
  let done = false;
  const finish = (): void => {
    if (done) return;
    done = true;
    document.removeEventListener('animationend', onEnd);
    window.clearTimeout(safety);
    callback();
  };
  const onEnd = (e: AnimationEvent): void => {
    if (
      e.animationName === 'page-fade-in' ||
      e.animationName === 'view-swap-in'
    ) {
      finish();
    }
  };
  const safety = window.setTimeout(finish, 600);
  window.requestAnimationFrame(() => {
    document.addEventListener('animationend', onEnd, true);
    // document.getAnimations 在 jsdom 与部分旧浏览器上缺失；缺失时
    // 等同于 hasVT=false (双 rAF 后立刻 finish)。
    const getAnims = document.getAnimations?.bind(document);
    const anims = typeof getAnims === 'function' ? getAnims() : [];
    const hasVT = anims.some((a) => {
      const name = (a as CSSAnimation).animationName ?? '';
      return name === 'page-fade-in' || name === 'view-swap-in';
    });
    if (!hasVT) {
      // No VT animation registered (instant nav, no VT support, or the
      // animation already finished in this frame). Fire callback after
      // one extra frame to let paint settle, so showModal() lands on
      // a settled surface.
      window.requestAnimationFrame(() => finish());
    }
  });
}
