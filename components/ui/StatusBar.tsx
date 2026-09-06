type Phase = 'idle' | 'playing' | 'won' | 'drawn';
type Player = 'X' | 'O';

type Props = {
  phase: Phase;
  currentPlayer: Player | null;
  winner: Player | null;
};

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
      className="text-h2 font-display font-medium text-center"
      data-testid="status-bar"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {phase === 'playing' && currentPlayer ? (
        <span
          aria-hidden
          className="player-pulse inline-block w-2 h-2 align-middle rounded-full mr-2 bg-accent"
        />
      ) : null}
      <span className={colorClass} data-testid="status-text">
        {message}
      </span>
    </div>
  );
}
