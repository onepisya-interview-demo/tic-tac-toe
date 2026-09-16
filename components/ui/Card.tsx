import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  /**
   * `min-height` token applied to the Card root. Use when the Card
   * swaps between two children of differing intrinsic heights (e.g.
   * /solo's Board ↔ SoloStatsPanel) and you want the surrounding row
   * to stay put while the content crossfades. Accepts any CSS length
   * (e.g. `'28rem'`, `'360px'`); left undefined = no min-height.
   */
  minH?: string;
  /**
   * `view-transition-name` applied to the Card root. Pass a stable
   * token (e.g. `'solo-card'`) so the browser groups the OLD and NEW
   * snapshots of the Card into a single morph instead of swapping
   * them separately. Required on both ends of an in-place content
   * swap; left undefined = no morph (legacy crossfade). The matching
   * CSS rule lives in app/globals.css under the `@supports (view-
   * transition-name: root)` block.
   */
  viewTransitionName?: string;
};

/**
 * Base Card primitive. The visual contract is fixed (bg-bg-elevated +
 * border-subtle + rounded-lg + p-6); per-call customization happens
 * through standard HTMLAttributes (data-testid, style, onClick, …)
 * and the two optional Card-specific props above.
 *
 * `viewTransitionName` is intentionally NOT in HTMLAttributes so the
 * API stays self-documenting: it exists to make the `view-transition`
 * platform API work for the /solo board↔stats swap without leaking
 * into other Card uses (home stats cards never animate). Inline style
 * is the safest carrier — React forwards it to the DOM and the
 * browser accepts `view-transition-name` as a regular CSS property
 * in modern engines.
 */
export function Card({
  children,
  className,
  minH,
  viewTransitionName,
  style,
  ...rest
}: Props) {
  const mergedStyle: CSSProperties = {
    ...(minH ? { minHeight: minH } : null),
    ...(viewTransitionName ? { viewTransitionName } : null),
    ...(style ?? null),
  };
  return (
    <div
      {...rest}
      style={Object.keys(mergedStyle).length > 0 ? mergedStyle : undefined}
      className={
        `bg-bg-elevated border border-border-subtle rounded-lg p-6 ${className ?? ''}`.trim()
      }
    >
      {children}
    </div>
  );
}
