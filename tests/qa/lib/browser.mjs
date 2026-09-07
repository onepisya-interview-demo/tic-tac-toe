// Shared browser bootstrap for the QA probes. One place decides headless,
// viewport, and the autoplay policy so script defaults never drift apart.
import { chromium } from 'playwright';

export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

export async function launchBrowser({ autoplay = false } = {}) {
  return chromium.launch({
    headless: true,
    args: autoplay ? ['--autoplay-policy=no-user-gesture-required'] : [],
  });
}

export async function launchQA(options = {}) {
  const browser = await launchBrowser(options);
  const ctx = await browser.newContext({
    viewport: options.viewport ?? { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
  return { browser, ctx, page };
}
