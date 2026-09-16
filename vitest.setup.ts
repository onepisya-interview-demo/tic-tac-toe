import '@testing-library/jest-dom/vitest';

// jsdom does not implement HTMLDialogElement.showModal/close. The
// production app uses showModal() so the browser owns the focus trap,
// ESC handler, and inert background; tests need a no-op shim so the
// dialog can still render and dispatch the cancel/close events the
// component subscribes to.
if (typeof HTMLDialogElement !== 'undefined') {
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & {
    showModal?: () => void;
    close?: (returnValue?: string) => void;
  };
  if (typeof proto.showModal !== 'function') {
    proto.showModal = function (): void {
      (this as HTMLDialogElement & { open: boolean }).open = true;
    };
  }
  if (typeof proto.close !== 'function') {
    proto.close = function (returnValue?: string): void {
      (this as HTMLDialogElement & { open: boolean }).open = false;
      this.dispatchEvent(new Event('close'));
      if (returnValue !== undefined) {
        (this as HTMLDialogElement & { returnValue: string }).returnValue = returnValue;
      }
    };
  }
}
