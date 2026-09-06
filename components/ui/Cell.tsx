'use client';

import type { Cell as CellValue, Player } from '@/lib/game';

type Props = {
  value: CellValue;
  onClick: () => void;
  disabled: boolean;
  isWinning: boolean;
  index: number;
};

const colorClass: Record<Player, string> = {
  X: 'text-player-x',
  O: 'text-player-o',
};

export function Cell({ value, onClick, disabled, isWinning, index }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || value !== null}
      aria-label={`第 ${index + 1} 格${value ? `，已落 ${value}` : '，空'}`}
      data-testid={`cell-${index}`}
      className={
        'w-24 h-24 flex items-center justify-center text-cell font-display font-semibold ' +
        'bg-bg-elevated border border-border-subtle rounded-md ' +
        'transition-colors duration-[120ms] ease-out ' +
        'hover:bg-bg-hover disabled:hover:bg-bg-elevated disabled:cursor-not-allowed ' +
        'active:scale-[0.98] transition-transform duration-[80ms] ease-out ' +
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base ' +
        (isWinning ? 'ring-2 ring-accent bg-accent-muted ' : '')
      }
    >
      <span className={value ? colorClass[value] : 'text-text-muted'}>
        {value ?? '\u00A0'}
      </span>
    </button>
  );
}
