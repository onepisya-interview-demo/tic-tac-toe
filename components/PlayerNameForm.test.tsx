import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerNameForm } from './PlayerNameForm';
import { useGameStore } from '@/lib/store';

// PlayerNameForm — W3 (ulw-name-login-one-truth) reframe: the form is
// now the home-page identity region. On submit it fires
// POST /api/player-session (注册 / 登录 primitive); the localStorage
// write + store mirror happen ONLY on a 2xx response, never on
// 422 / network failure / abort. We stub globalThis.fetch so the
// test doesn't hit the network; individual tests vary the response
// shape to cover 注册 vs 登录 vs failure branches.

const fetchSpy = vi.spyOn(globalThis, 'fetch');
fetchSpy.mockResolvedValue(
  new Response(
    '{"stats":{"totalGames":0,"xWins":0,"oWins":0,"draws":0,"currentStreak":0},"existed":false}',
    { status: 200, headers: { 'content-type': 'application/json' } },
  ),
);

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  fetchSpy.mockClear();
  fetchSpy.mockResolvedValue(
    new Response(
      '{"stats":{"totalGames":0,"xWins":0,"oWins":0,"draws":0,"currentStreak":0},"existed":false}',
      { status: 200, headers: { 'content-type': 'application/json' } },
    ),
  );
  useGameStore.setState({ playerName: null });
});

describe('components/PlayerNameForm', () => {
  it('label 前置规则 「名字（1-24 字符，注册后不可修改）」（不在 placeholder 里）', () => {
    render(<PlayerNameForm />);
    const label = screen.getByText('名字（1-24 字符，注册后不可修改）');
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

  it('保存按钮：触发 POST /api/player-session 注册/登录', async () => {
    const user = userEvent.setup();
    render(<PlayerNameForm />);
    await user.type(screen.getByTestId('player-name-input'), 'pname-form-A');
    await user.click(screen.getByTestId('player-name-save'));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const posts = fetchSpy.mock.calls.filter((c) => {
      const init = (c[1] ?? {}) as RequestInit;
      return (init.method ?? 'GET').toUpperCase() === 'POST';
    });
    expect(posts.length).toBeGreaterThanOrEqual(1);
    const [url, init] = posts[0];
    expect(String(url)).toBe('/api/player-session');
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      name: 'pname-form-A',
    });
  });

  it('注册（新名）成功：写 localStorage + 显示「注册成功」反馈', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        '{"stats":{"totalGames":0,"xWins":0,"oWins":0,"draws":0,"currentStreak":0},"existed":false}',
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const user = userEvent.setup();
    render(<PlayerNameForm />);
    await user.type(screen.getByTestId('player-name-input'), 'pname-new');
    await user.click(screen.getByTestId('player-name-save'));
    const feedback = await screen.findByTestId('player-name-feedback');
    expect(feedback).toHaveTextContent('注册成功');
    expect(feedback.getAttribute('data-feedback-kind')).toBe('register');
    expect(window.localStorage.getItem('ttt.player.name.v1')).toBe('pname-new');
    expect(useGameStore.getState().playerName).toBe('pname-new');
  });

  it('登录（已存在）成功：写 localStorage + 显示「已为你登录」反馈', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        '{"stats":{"totalGames":3,"xWins":2,"oWins":0,"draws":1,"currentStreak":1},"existed":true}',
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const user = userEvent.setup();
    render(<PlayerNameForm />);
    await user.type(screen.getByTestId('player-name-input'), 'pname-known');
    await user.click(screen.getByTestId('player-name-save'));
    const feedback = await screen.findByTestId('player-name-feedback');
    expect(feedback).toHaveTextContent('已为你登录，欢迎回来 pname-known');
    expect(feedback.getAttribute('data-feedback-kind')).toBe('login');
    expect(window.localStorage.getItem('ttt.player.name.v1')).toBe('pname-known');
  });

  it('422 错误：localStorage 与 store.playerName 不写入；错误就地展示', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('{"error":"invalid player name"}', { status: 422 }),
    );
    const user = userEvent.setup();
    render(<PlayerNameForm />);
    await user.type(screen.getByTestId('player-name-input'), 'pname-bad');
    await user.click(screen.getByTestId('player-name-save'));
    const feedback = await screen.findByTestId('player-name-feedback');
    expect(feedback).toHaveTextContent('名字含不允许的字符');
    expect(feedback.getAttribute('role')).toBe('alert');
    // A2: never wrote to localStorage / store on failure
    expect(window.localStorage.getItem('ttt.player.name.v1')).toBeNull();
    expect(useGameStore.getState().playerName).toBeNull();
  });

  it('非法名字（空）：保存按钮按下无效（fetch 不发）', async () => {
    const user = userEvent.setup();
    render(<PlayerNameForm />);
    const input = screen.getByTestId('player-name-input');
    // Type then delete → empty. isPlayerName rejects empty.
    await user.type(input, 'x');
    await user.clear(input);
    await user.click(screen.getByTestId('player-name-save'));
    await new Promise((r) => setTimeout(r, 0));
    const posts = fetchSpy.mock.calls.filter((c) => {
      const init = (c[1] ?? {}) as RequestInit;
      return (init.method ?? 'GET').toUpperCase() === 'POST';
    });
    expect(posts.length).toBe(0);
  });

  it('localStorage「ttt.player.name.v1」保存后写入', async () => {
    const user = userEvent.setup();
    render(<PlayerNameForm />);
    await user.type(screen.getByTestId('player-name-input'), 'pname-form-C');
    await user.click(screen.getByTestId('player-name-save'));
    await waitFor(() =>
      expect(window.localStorage.getItem('ttt.player.name.v1')).toBe(
        'pname-form-C',
      ),
    );
  });

  // W3 (ulw-name-login-one-truth): the home-return path expects the
  // online card to render as soon as the user lands on / with a name
  // in localStorage. PlayerNameForm is the single point of hydration
  // — when the store is empty but localStorage has the name, mirror
  // it back so OnlineStatsCard's useEffect fires.
  it('store empty + localStorage has name → hydrates store (so online card renders on home-return)', async () => {
    window.localStorage.setItem('ttt.player.name.v1', 'pre-existing');
    expect(useGameStore.getState().playerName).toBeNull();
    render(<PlayerNameForm />);
    await waitFor(() =>
      expect(useGameStore.getState().playerName).toBe('pre-existing'),
    );
  });
});
