import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { GameShell } from './GameShell';
import { resetStore } from '@/tests/helpers/reset-store';
afterEach(() => {
  cleanup();
  resetStore();
});

describe('components/GameShell', () => {
  it('renders the header (title + SoundToggle + StatusBar), the card children, and the footer action slot', () => {
    render(
      <GameShell
        title="单机练习"
        actions={
          <button type="button" data-testid="action-slot-probe">
            动作
          </button>
        }
      >
        <div data-testid="content-slot-probe">内容</div>
      </GameShell>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('单机练习');
    // Client boundaries owned by the shell, not by the page.
    expect(screen.getByTestId('sound-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
    expect(screen.getByTestId('status-text')).toHaveTextContent('准备开始');

    // Slot contracts: children land inside the Card, actions inside the
    // footer row — the same structure /play had before the extraction.
    const content = screen.getByTestId('content-slot-probe');
    expect(content.closest('main')).not.toBeNull();
    expect(screen.getByTestId('action-slot-probe')).toBeInTheDocument();

    // The shell itself stays markup-thin: exactly one h1 per page (the
    // title slot), so pages can't accidentally add a second heading.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('keeps the page shell classes that QA and motion rely on', () => {
    const { container } = render(
      <GameShell title="游戏中" actions={null}>
        <div />
      </GameShell>,
    );
    const main = container.querySelector('main');
    expect(main).not.toBeNull();
    expect(main).toHaveClass('page-shell');
    expect(main).toHaveClass('page-fade-in');
  });
});
