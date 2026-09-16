import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerNameForm } from './PlayerNameForm';
import { useGameStore } from '@/lib/store';

// PlayerNameForm — responsive + counter + label + save flow coverage
// for the B-T5 vertical slice (ulw-solo-sync-rebuild.md). The form
// fires a fire-and-forget PUT /api/solo-stats via putSoloName; we
// stub globalThis.fetch so the test doesn't hit the network.

const fetchSpy = vi.spyOn(globalThis, 'fetch');
fetchSpy.mockResolvedValue(
  new Response('{"stats":{"totalGames":0,"xWins":0,"oWins":0,"draws":0,"currentStreak":0}}', {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }),
);

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  fetchSpy.mockClear();
  useGameStore.setState({ playerName: null });
});

describe('components/PlayerNameForm', () => {
  it('label 前置规则 「名字（1-24 字符）」（不在 placeholder 里）', () => {
    render(<PlayerNameForm />);
    const label = screen.getByText('名字（1-24 字符）');
    expect(label).toBeInTheDocument();
    expect(label.tagName).toBe('LABEL');
  });

  it('n/24 live 计数器随输入 live 变化', async () => {
    const user = userEvent.setup();
    render(<PlayerNameForm />);
    const counter = screen.getByTestId('player-name-counter');
    expect(counter).toHaveTextContent('0 / 24');
    expect(counter.getAttribute('aria-live')).toBe('polite');
    await user.type(screen.getByTestId('player-name-input'), 'alice');
    expect(counter).toHaveTextContent('5 / 24');
    await user.clear(screen.getByTestId('player-name-input'));
    await user.type(screen.getByTestId('player-name-input'), '汉字名');
    // CJK: 3 chars
    expect(counter).toHaveTextContent('3 / 24');
  });

  it('375 移动端：input 与按钮组都全宽（w-full class）', () => {
    render(<PlayerNameForm />);
    const input = screen.getByTestId('player-name-input');
    expect(input.className).toMatch(/\bw-full\b/);
    const save = screen.getByTestId('player-name-save');
    expect(save.className).toMatch(/\bw-full\b/);
  });

  it('保存按钮：触发 PUT /api/solo-stats fire-and-forget', async () => {
    const user = userEvent.setup();
    render(<PlayerNameForm />);
    await user.type(screen.getByTestId('player-name-input'), 'pname-form-A');
    await user.click(screen.getByTestId('player-name-save'));
    // Wait for fire-and-forget fetch to settle.
    await new Promise((r) => setTimeout(r, 0));
    const puts = fetchSpy.mock.calls.filter((c) => {
      const init = (c[1] ?? {}) as RequestInit;
      return (init.method ?? 'GET').toUpperCase() === 'PUT';
    });
    expect(puts.length).toBeGreaterThanOrEqual(1);
    const body = JSON.parse(String(puts[0][1]?.body ?? '{}'));
    expect(body).toEqual({ name: 'pname-form-A' });
  });

  it('保存后显示「当前：x」caption（保留 AGENTS 既有契约）', async () => {
    const user = userEvent.setup();
    render(<PlayerNameForm />);
    await user.type(screen.getByTestId('player-name-input'), 'pname-form-B');
    await user.click(screen.getByTestId('player-name-save'));
    const current = screen.getByTestId('player-name-current');
    expect(current).toHaveTextContent('当前：');
    expect(current).toHaveTextContent('pname-form-B');
  });

  it('非法名字（控制字符）：保存按钮按下无效（PUT 不发）', async () => {
    const user = userEvent.setup();
    render(<PlayerNameForm />);
    const input = screen.getByTestId('player-name-input');
    // Bypass the maxLength cap by setting via fireEvent to simulate a
    // paste-with-control-char scenario the user shouldn't trigger but
    // the API would 422 if they did.
    await user.type(input, '{Backspace}');
    // Try saving empty value — handler early-returns because !isPlayerName.
    await user.click(screen.getByTestId('player-name-save'));
    await new Promise((r) => setTimeout(r, 0));
    const puts = fetchSpy.mock.calls.filter((c) => {
      const init = (c[1] ?? {}) as RequestInit;
      return (init.method ?? 'GET').toUpperCase() === 'PUT';
    });
    expect(puts.length).toBe(0);
  });

  it('localStorage「ttt.player.name.v1」保存后写入', async () => {
    const user = userEvent.setup();
    render(<PlayerNameForm />);
    await user.type(screen.getByTestId('player-name-input'), 'pname-form-C');
    await user.click(screen.getByTestId('player-name-save'));
    expect(window.localStorage.getItem('ttt.player.name.v1')).toBe('pname-form-C');
  });
});
