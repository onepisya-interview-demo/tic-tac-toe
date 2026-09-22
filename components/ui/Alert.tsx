'use client';

import type { ReactNode } from 'react';

/**
 * Alert 组件（案② 网络超时/错误提醒 — components/ui/Alert.tsx）
 *
 * 统一错误块 UI 契约；目前只暴露 `danger` 变体（项目唯一需要），将来
 * `info` / `success` / `warning` 可按相同 model 加 Variant 枚举值。
 *
 * 设计契约（DESIGN.md §1 + §6 焦点契约）：
 *  - role 默认 'alert'，与原三处 `text-small text-text-secondary` 错误行
 *    的可访问性契约保持一致；'status' 给「非用户操作触发的背景事件」
 *    （如 outcome error banner）。
 *  - 颜色全走 @theme danger token，与 globals.css 单一真源绑定。
 *  - 内联 SVG 图标（无第三方库；DESIGN.md §6 / L0-5）。
 *  - 不引入新水合触发点（纯服务端能渲染）。
 *  - data-testid 由 caller 传；不传则用 'ui-alert'。
 */
export type AlertVariant = 'danger';

export interface AlertProps {
  variant?: AlertVariant;
  /** 可见标题；省略则不渲染 title 行 */
  title?: string;
  /** 可见正文 */
  children: ReactNode;
  /** ARIA role；默认 'alert'（同步错误）；'status'（异步 / 背景事件） */
  role?: 'alert' | 'status';
  /** QA 选择器；不传则用 'ui-alert' */
  'data-testid'?: string;
  className?: string;
}

export function Alert({
  variant = 'danger', // eslint-disable-line @typescript-eslint/no-unused-vars
  title,
  children,
  role = 'alert',
  className,
  ...rest
}: AlertProps) {
  const testId = rest['data-testid'] ?? 'ui-alert';
  return (
    <div
      role={role}
      data-testid={testId}
      className={[
        'rounded-md border px-4 py-3 flex items-start gap-3',
        'bg-danger-surface border-danger-border text-danger',
        className ?? '',
      ]
        .join(' ')
        .trim()}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="currentColor"
        className="mt-0.5 h-4 w-4 flex-shrink-0"
      >
        <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3a1 1 0 011 1v4a1 1 0 11-2 0V5a1 1 0 011-1zm0 8a1 1 0 100 2 1 1 0 000-2z" />
      </svg>
      <div className="flex-1 min-w-0">
        {title ? <p className="font-medium mb-1">{title}</p> : null}
        <div className="text-small leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
