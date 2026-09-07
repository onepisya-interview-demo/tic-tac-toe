// Deterministic top-row win: the first player takes 0, 1, 2 while the second
// takes 3, 4 — whoever wins the randomized coin flip ends up winning on the
// top row, so probes never depend on the first-player draw.
export async function driveTopRowWin(page, { clickGapMs = 120 } = {}) {
  for (const i of [0, 3, 1, 4, 2]) {
    await page.click(`[data-testid="cell-${i}"]`);
    await page.waitForTimeout(clickGapMs);
  }
}
