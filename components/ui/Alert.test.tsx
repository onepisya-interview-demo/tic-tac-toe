// BR: 案② 错误行契约 — components/ui/Alert.tsx 渲染契约
//
// Source: components/ui/Alert.tsx (873a255) + .omo/plans/ulw-transition-alert-unit-tests-20260923.md §四

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Alert } from './Alert';

function renderAlert(
  props: Partial<React.ComponentProps<typeof Alert>> = {},
): ReturnType<typeof render> {
  return render(<Alert {...props}>{props.children ?? 'alert body'}</Alert>);
}

describe('components/ui/Alert (danger error block contract)', () => {
  it('defaults role to "alert" when caller does not pass one', () => {
    // Contract: Alert.tsx:39,46 — destructured default `role = 'alert'`
    // (:39) is forwarded as the JSX `role` attribute (:46) so assistive tech
    // announces the message immediately on a synchronous error surface.
    renderAlert();
    expect(screen.getByTestId('ui-alert')).toHaveAttribute('role', 'alert');
  });

  it('forwards role="status" for async / background error events', () => {
    // Contract: Alert.tsx:29,46 — AlertProps `role?: 'alert' | 'status'`
    // (:29) accepts 'status', and the JSX `role={role}` attribute (:46)
    // forwards it unchanged. OutcomeErrorBanner uses this variant
    // (components/OutcomeErrorBanner.tsx:39-58).
    renderAlert({ role: 'status' });
    expect(screen.getByTestId('ui-alert')).toHaveAttribute('role', 'status');
  });

  it('uses "ui-alert" as the default data-testid and forwards a custom one', () => {
    // Contract: Alert.tsx:31,43,47 — AlertProps `'data-testid'?: string`
    // (:31) declares the override; `const testId = rest['data-testid'] ??
    // 'ui-alert'` (:43) computes the default; JSX `data-testid={testId}`
    // (:47) forwards it. Callers such as RoomGateDialog
    // ('room-gate-error', components/RoomGateDialog.tsx:227) and
    // SyncConfirmDialog ('sync-confirm-error', components/SyncConfirmDialog.tsx:274)
    // override it; both code paths must work.
    const { rerender } = renderAlert();
    expect(screen.getByTestId('ui-alert')).toBeInTheDocument();
    rerender(
      <Alert data-testid="sync-confirm-error">同步失败：超时</Alert>,
    );
    expect(screen.getByTestId('sync-confirm-error')).toBeInTheDocument();
    expect(screen.queryByTestId('ui-alert')).not.toBeInTheDocument();
  });

  it('renders the title paragraph only when title prop is provided', () => {
    // Contract: Alert.tsx:65 — `title ? <p>...</p> : null` makes the title
    // optional. A missing title must NOT leave an empty <p> in the DOM
    // (visual + a11y: no empty heading-like paragraph).
    const { rerender } = renderAlert();
    // Without title: no <p class="font-medium ..."> at all.
    expect(screen.queryByText(/.+/, { selector: 'p.font-medium' })).not.toBeInTheDocument();
    // Re-render with a title; the paragraph should appear.
    rerender(<Alert title="操作失败">请稍后重试</Alert>);
    expect(screen.getByText('操作失败')).toBeInTheDocument();
  });

  it('marks the inline svg icon aria-hidden so screen readers skip it', () => {
    // Contract: Alert.tsx:57 — the warning triangle is decorative; the
    // role-bearing <div> already conveys the alert semantics.
    const { container } = renderAlert();
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders children as the body content', () => {
    // Contract: Alert.tsx:66 — the visible body slot is rendered as the
    // last child of the right column.
    renderAlert({ children: '同步失败：网络异常' });
    expect(screen.getByText('同步失败：网络异常')).toBeInTheDocument();
  });

  it('merges the caller className without dropping the base classes', () => {
    // Contract: Alert.tsx:48-54 — the base class list (rounded / border /
    // flex / danger tokens) must always be present so the alert is visible
    // even if the caller passes only their own layout helper class.
    renderAlert({ className: 'mt-2' });
    const node = screen.getByTestId('ui-alert');
    expect(node.className).toContain('mt-2');
    // Base identity classes (subset check; if a future refactor drops any
    // of these, the assertion surfaces it).
    expect(node.className).toContain('rounded-md');
    expect(node.className).toContain('border');
    expect(node.className).toContain('bg-danger-surface');
    expect(node.className).toContain('border-danger-border');
    expect(node.className).toContain('text-danger');
  });
});
