// Shared evidence capture for QA runs: evidence dir, full-page screenshots,
// and the qa-log.json artifact.
import fs from 'node:fs/promises';
import path from 'node:path';

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export function shootTo(dir) {
  return async (page, name) => {
    const p = path.join(dir, name);
    await page.screenshot({ path: p, fullPage: true });
    return p;
  };
}

export async function writeQaLog(dir, log) {
  await fs.writeFile(path.join(dir, 'qa-log.json'), JSON.stringify(log, null, 2));
}
