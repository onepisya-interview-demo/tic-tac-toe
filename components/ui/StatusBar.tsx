type Phase = 'idle' | 'playing' | 'won' | 'drawn';
type Player = 'X' | 'O';

type Props = {
  phase: Phase;
  currentPlayer: Player | null;
  winner: Player | null;
};

/**
 * Inline status announcement for the /play and /solo header row. The
 * shell wraps this in a flex row alongside the h1 and SoundToggle, so
 * the root must NOT be a centered text-h2 block (that would force the
 * row to two lines on mobile). It now renders as a compact
 * `display: inline-grid` pill that stacks all four phase messages in
 * the same grid cell (grid-area: 1/1) and toggles their visibility —
 * the cell width is the max of all messages, so transitions between
 * 轮到 X → X 获胜 → 平局 → 准备开始 never resize the surrounding
 * <button> (Bug C width jitter fix).
 *
 * Why grid-stack and not (a) padding the longest message into every
 * state (still drifts with font metrics) or (b) min-w-[Nch] on the
 * button (would clamp the visible text to a fixed slot and force a
 * visible gap on short messages): grid-area: 1/1 is the canonical
 * "no layout shift when content swaps" pattern (Hubert Sablonnière,
 * "Prevent layout shifts with CSS grid stacks"). The visible state is
 * the only one not aria-hidden and not visibility: hidden, so the
 * aria-live="polite" announcement stays a single token (status-text).
 *
 * The playing state's pulse dot stays in the DOM regardless of active
 * state — it is part of the cell's intrinsic width and the grid
 * picks it up so won / drawn / idle transitions don't shrink the
 * button. The dot itself is `aria-hidden` and the visibility:hidden
 * wrapper means it never reaches screen readers.
 *
 * Mobile single-row contract (375×667): `text-small` keeps the row's
 * tallest slot at the h1 / SoundToggle height; the grid-stack pattern
 * is layout-agnostic (no min-width / padding tricks) so 375px fits
 * without overflow.
 */
export function StatusBar({ phase, currentPlayer, winner }: Props) {
  // The four phase messages, all stacked into the same grid cell. Only
  // the one matching the current phase is visible + a11y-reachable; the
  // rest are visibility: hidden which removes them from the
  // accessibility tree (so aria-live announces only the active message)
  // but keeps them in layout (so the cell width stays at max-of-all).
  const cells = [
    {
      id: 'idle',
      active: phase === 'idle',
      text: '准备开始',
      className: 'text-text-muted',
      dot: false,
    },
    {
      id: 'playing',
      active: phase === 'playing' && !!currentPlayer,
      text: currentPlayer ? `轮到 ${currentPlayer}` : '',
      className: currentPlayer === 'X' ? 'text-player-x' : 'text-player-o',
      dot: true,
    },
    {
      id: 'won',
      active: phase === 'won' && !!winner,
      text: winner ? `${winner} 获胜` : '',
      className: winner === 'X' ? 'text-player-x' : 'text-player-o',
      dot: false,
    },
    {
      id: 'drawn',
      active: phase === 'drawn',
      text: '平局',
      className: 'text-text-secondary',
      dot: false,
    },
  ];

  return (
    <div
      className="status-pill text-small font-display font-medium whitespace-nowrap"
      data-testid="status-bar"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {cells.map((cell) => (
        <span
          key={cell.id}
          data-testid={cell.active ? 'status-text' : undefined}
          aria-hidden={cell.active ? undefined : true}
          className={`status-cell inline-flex items-center ${cell.className} ${
            cell.active ? '' : 'status-cell-hidden'
          }`}
        >
          {cell.dot ? (
            <span
              aria-hidden
              className="player-pulse inline-block w-2 h-2 rounded-full mr-2 bg-accent shrink-0"
            />
          ) : null}
          {cell.text}
        </span>
      ))}
    </div>
  );
}
