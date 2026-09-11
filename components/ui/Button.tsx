import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  /**
   * When true the button renders as busy: disabled, aria-busy, and a
   * CSS-only spinner span appears before the children. Wire-up lives
   * in ResetStatsButton / ResultActions (commit 5 / 6) so the reset
   * action stops feeling unresponsive during Turso HTTP hangs longer
   * than 8 s (HAR §P2 evidence: 30 733 ms DELETE observed once).
   *
   * The visual contract is DESIGN.md §6 — every decorative animation
   * has a prefers-reduced-motion no-animation path. The existing
   * globals.css `@media (prefers-reduced-motion: reduce)` block already
   * collapses `animation-duration` to 0ms globally, so the spinner's
   * `animation: button-spin 700ms linear infinite` is auto-disabled
   * without any extra gating code in this primitive.
   */
  loading?: boolean;
  children: ReactNode;
};

const base =
  'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors duration-[120ms] ease-out ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-bg-base hover:bg-accent-hover px-5 py-2.5 text-base',
  secondary:
    'bg-bg-elevated text-text-primary hover:bg-bg-hover border border-border-subtle px-5 py-2.5 text-base',
  ghost:
    'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-hover px-3 py-2 text-sm',
};

export function Button({
  variant = 'primary',
  className,
  loading = false,
  disabled,
  children,
  ...rest
}: Props) {
  const isBusy = loading || disabled;
  // Pick up the caller's data-testid (used by QA selectors + commit 5/6
  // wiring) so the spinner testid matches the button testid with a
  // `-loading` suffix; fall back to `button` so primitive callers
  // without a testid still get a deterministic selector.
  const restWithTestId = rest as ButtonHTMLAttributes<HTMLButtonElement> & {
    'data-testid'?: string;
  };
  const callerTestId = restWithTestId['data-testid'];
  const testId = typeof callerTestId === 'string' && callerTestId.length > 0
    ? callerTestId
    : 'button';
  return (
    <button
      {...rest}
      disabled={isBusy}
      aria-busy={loading ? true : undefined}
      data-loading={loading ? '' : undefined}
      className={`${base} ${variants[variant]} ${className ?? ''}`.trim()}
    >
      {loading ? (
        <span
          data-testid={`${testId}-loading`}
          aria-hidden="true"
          className="button-spinner"
        />
      ) : null}
      {children}
    </button>
  );
}
