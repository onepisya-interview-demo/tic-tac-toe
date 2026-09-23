/**
 * Schema.org JSON-LD payload for the home page
 * (W3 ulw-one-game-two-versions AC A8).
 *
 * The shape follows the plan §1 vocabulary alignment (schema.org
 * GamePlayMode + WebApplication for AI / search-engine ingestion).
 *
 * Two surface concerns live in this file:
 *  - The literal payload (`HOME_JSON_LD`) — single source of truth
 *    for what the crawler / AI consumes.
 *  - `serializeHomeJsonLd()` — the Next.js 16 doc-recommended XSS-safe
 *    stringifier that escapes `<` to `\u003c`.
 *
 * The home page imports `serializeHomeJsonLd` only — no React, no
 * RSC — so unit tests can assert the payload shape without spinning
 * up the React server renderer.
 */
export const HOME_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': ['VideoGame', 'WebApplication'],
  name: '井字棋',
  description:
    '两人同设备轮流下，自动记录战绩；支持离线单机与在线云端实时上服两种版本。',
  playMode: 'https://schema.org/MultiPlayer',
  numberOfPlayers: {
    '@type': 'QuantitativeValue',
    minValue: 1,
    maxValue: 2,
  },
  applicationCategory: 'Game',
  gamePlatform: 'Web Browser',
  operatingSystem: 'Any',
  genre: 'Board Game',
  inLanguage: 'zh-CN',
  offers: {
    '@type': 'Offer',
    price: 0,
    priceCurrency: 'CNY',
  },
  url: 'https://3t.onepis.net/',
} as const;

/**
 * Stringify the JSON-LD payload with Next.js 16's recommended XSS
 * guard: escape `<` to its unicode escape `\u003c` so a future
 * addition of user-controlled fields (or a typo in a static field)
 * cannot inject a closing <script> tag.
 */
export function serializeHomeJsonLd(): string {
  return JSON.stringify(HOME_JSON_LD).replace(/</g, '\\u003c');
}
