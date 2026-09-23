'use client';

/**
 * OutcomeErrorBanner (ulw-modal-collision-and-error-alerts 案② c)
 *
 * 渲染最近一次 online 记局失败的可见提醒——之前在 makeMove online
 * 分支里 r.ok === false 时静默 return, 用户不知战报未上服, /result
 * 渲染旧行造成混乱。本组件订阅 useGameStore.outcomeError, 非空时
 * 渲染 Alert（含 reason 文案映射 + 关闭按钮）。
 *
 * 设计契约:
 *  - 挂载点: app/online/page.tsx + app/result/page.tsx（online 模式下
 *    唯一会触发的路径, offline 不发网络写)。
 *  - role='status'（非用户操作触发的事件, ARIA 语义更准）。
 *  - 自带关闭按钮 → setOutcomeError(null), 不依赖 toast 库。
 *  - 数据流单向: store → UI, 无 effect 副作用。
 */

import { Alert } from '@/components/ui/Alert';
import { useGameStore } from '@/lib/store';

const REASON_COPY: Record<string, string> = {
  aborted: '战报上传超时（战绩未上服，请稍后重试）',
  'network-error': '战报上传失败（网络异常，战绩未上服）',
  'http-error': '战报上传失败（战绩未上服）',
  'not-found': '战报上传失败（房间不存在）',
};

function copyFor(reason: string): string {
  return REASON_COPY[reason] ?? `战报上传失败 (${reason})`;
}

export function OutcomeErrorBanner() {
  const outcomeError = useGameStore((s) => s.outcomeError);
  const setOutcomeError = useGameStore((s) => s.setOutcomeError);
  if (outcomeError === null) return null;
  return (
    <div className="mb-4">
      <Alert
        variant="danger"
        role="status"
        data-testid="outcome-error-banner"
        title="战报未上服"
      >
        <span>{copyFor(outcomeError.reason)}</span>{' '}
        <button
          type="button"
          onClick={() => setOutcomeError(null)}
          data-testid="outcome-error-banner-dismiss"
          aria-label="关闭战报失败提醒"
          className="ml-2 underline underline-offset-2 hover:text-danger-strong"
        >
          关闭
        </button>
      </Alert>
    </div>
  );
}
