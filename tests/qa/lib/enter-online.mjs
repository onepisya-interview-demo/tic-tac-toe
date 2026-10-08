// Home → /online navigation under the RoomGateDialog entry gate
// (probe-repair ticket 18, 2026-10-09).
//
// c75cfdf/c9ef27f (ulw-room-migration-home-landing) made the home
// start-online CTA gated: an anonymous click no longer navigates —
// StartGameButton dispatches `ttt:room-required`, RoomGateMount opens
// the RoomGateDialog, and only a successful register-or-enter
// (POST /api/rooms) makes RoomGateMount call startGame + push
// /online. The pre-gate probe sequence `click(start-online) →
// waitForURL(**/online)` therefore hangs forever (the
// KNOWN_STALE_PROBES "入口漂移族" root cause).
//
// This helper is the single shared implementation of the CURRENT legal
// sequence, lifted from the already-updated green probe
// result-celebration-qa.mjs `enterOnlineViaGate` so the five repaired
// probes can never drift apart again:
//   click start-online → wait dialog [open] → fill room name →
//   confirm (POST /api/rooms) → wait /online → wait board.
import { BASE_URL } from './browser.mjs';

/**
 * Pass the RoomGateDialog from an already-loaded home page and land
 * on a playable /online (board visible).
 *
 * Precondition: the page is on `/` and interactive (any SoundToggle
 * clicks etc. already done — the dialog is an in-page overlay, and
 * the unmuted flag lives in localStorage so it survives the
 * navigation). `room` must pass the 1–24-char whitelist (no control
 * characters) or the confirm button never unlocks.
 */
export async function passRoomGate(page, room, { timeout = 8000 } = {}) {
  await page.click('[data-testid="start-online"]');
  await page.waitForSelector('[data-testid="room-gate-dialog"][open]', {
    timeout: 4000,
  });
  await page.fill('[data-testid="room-gate-name"]', room);
  await page.click('[data-testid="room-gate-confirm"]');
  // Regex (not the `**/online` glob): the glob form is fine for the
  // bare /online URL but the win push below goes to `/result?room=…`,
  // and end-anchored globs do not match query strings — the green
  // probes all use /\/…/ regexes for that reason. Same shape here.
  await page.waitForURL(/\/online/, { timeout });
  await page.waitForSelector('[data-testid="board"]', { timeout });
}

/** goto the home page, then passRoomGate — one call for probes that
 *  do not need to interact with the home page before entering. */
export async function enterOnlineViaGate(page, room, opts = {}) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await passRoomGate(page, room, opts);
}
