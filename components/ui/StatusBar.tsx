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
 * row to two lines on mobile). It now renders as a compact inline-flex
 * pill: the playing pulse dot stays, the role/aria-live/testid
 * contract is preserved, and the size drops to text-small (14/20) so
 * the row's tallest slot is the title or the SoundToggle, not the
 * status text. Colors are unchanged. No new tokens.
 */
export function StatusBar({ phase, currentPlayer, winner }: Props) {
  let message: string;
  let colorClass = 'text-text-primary';
  if (phase === 'playing' && currentPlayer) {
    message = `轮到 ${currentPlayer}`;
    colorClass = currentPlayer === 'X' ? 'text-player-x' : 'text-player-o';
  } else if (phase === 'won' && winner) {
    message = `${winner} 获胜`;
    colorClass = winner === 'X' ? 'text-player-x' : 'text-player-o';
  } else if (phase === 'drawn') {
    message = '平局';
    colorClass = 'text-text-secondary';
  } else {
    message = '准备开始';
    colorClass = 'text-text-muted';
  }

  return (
    <div
      className="inline-flex items-center text-small font-display font-medium whitespace-nowrap"
      data-testid="status-bar"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {phase === 'playing' && currentPlayer ? (
        <span
          aria-hidden
          className="player-pulse inline-block w-2 h-2 rounded-full mr-2 bg-accent shrink-0"
        />
      ) : null}
      <span className={colorClass} data-testid="status-text">
        {message}
      </span>
    </div>
  );
}
