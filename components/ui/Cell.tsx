'use client';

import type { Cell as CellValue, Player } from '@/lib/game';

type Props = {
  value: CellValue;
  onClick: () => void;
  disabled: boolean;
  isWinning: boolean;
  index: number;
  tabIndex?: number;
};

const colorClass: Record<Player, string> = {
  X: 'text-player-x',
  O: 'text-player-o',
};

export function Cell({ value, onClick, disabled, isWinning, index, tabIndex }: Props) {
  // Re-keying the inner span on the value forces React to remount it whenever
  // a mark appears, which restarts the CSS cell-pop animation. The class stays
  // attached while the value persists, so subsequent re-renders do not re-fire.
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || value !== null}
      aria-label={
        `第 ${index + 1} 格` +
        (value ? `，已落 ${value}` : '，空') +
        (isWinning ? '，胜局' : '')
      }
      data-testid={`cell-${index}`}
      tabIndex={tabIndex ?? -1}
      className={
        'relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center text-cell font-display font-semibold ' +
        'bg-bg-elevated border border-border-subtle rounded-md ' +
        'transition-colors duration-[120ms] ease-out ' +
        'hover:bg-bg-hover disabled:hover:bg-bg-elevated disabled:cursor-not-allowed ' +
        'active:scale-[0.98] transition-transform duration-[80ms] ease-out ' +
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base ' +
        (isWinning ? 'ring-2 ring-accent bg-accent-muted ' : '')
      }
    >
      {value !== null ? (
        <span
          key={value}
          className={'inline-block cell-pop ' + colorClass[value]}
          data-value={value}
          data-testid={`cell-${index}-mark`}
        >
          {value}
        </span>
      ) : (
        <span aria-hidden className="text-text-muted inline-block">
          {'\u00A0'}
        </span>
      )}
      {isWinning ? (
        <span aria-hidden className="win-glow absolute inset-0 rounded-md" data-testid={`cell-${index}-glow`} />
      ) : null}
    </button>
  );
}
