import { NextResponse } from 'next/server';
import {
  accumulateSoloRecord,
  loadSoloRecord,
} from '@/lib/db';

// Same Node.js runtime rationale as app/api/stats/outcome/route.ts:
// @libsql/client's native sqlite module needs Node built-ins (`node:fs`,
// `node:path`), and Next.js 16 deprecates the Edge runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Player-name whitelist (mirrored on the client at lib/player-name.ts so
// POST cannot sneak through a value the GET would reject). Trim, then
// 1–24 visible characters, then reject anything below U+0020 or in the
// DEL/U+007F..U+009F control range. Allowing the rest of Unicode (CJK,
// accents, emoji) keeps the door open for non-ASCII names without
// making the rule opaque.
const NAME_MAX = 24;
const NAME_MIN = 1;

function isValidPlayerName(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) return false;
  for (let i = 0; i < trimmed.length; i += 1) {
    const code = trimmed.charCodeAt(i);
    if (code < 0x20) return false;
    if (code === 0x7f) return false;
    // C1 control range — not reachable from a JSON string the way Next
    // decodes it, but the explicit check keeps the contract intact.
    if (code >= 0x80 && code <= 0x9f) return false;
  }
  // Disallow a row whose PK is the empty string after trim (defensive:
  // the length check above already covers this, but explicit is cheaper
  // than reading a 422 with a confusing DB constraint error).
  return trimmed.length > 0;
}

function normalizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return isValidPlayerName(trimmed) ? trimmed : null;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const name = normalizeName(url.searchParams.get('name'));
  if (name === null) {
    return NextResponse.json(
      { error: 'invalid player name' },
      { status: 422 },
    );
  }
  try {
    const stats = await loadSoloRecord(name);
    return NextResponse.json({ stats });
  } catch {
    return NextResponse.json({ error: 'db unavailable' }, { status: 500 });
  }
}

function isSoloBody(
  v: unknown,
): v is { name: string; outcome: 'X' | 'O' | 'draw' } {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  if (typeof r.name !== 'string') return false;
  if (r.outcome !== 'X' && r.outcome !== 'O' && r.outcome !== 'draw') {
    return false;
  }
  return true;
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!isSoloBody(body)) {
    return NextResponse.json(
      { error: 'invalid request shape' },
      { status: 422 },
    );
  }
  const name = normalizeName(body.name);
  if (name === null) {
    return NextResponse.json(
      { error: 'invalid player name' },
      { status: 422 },
    );
  }
  try {
    const next = await accumulateSoloRecord(name, body.outcome);
    return NextResponse.json({ stats: next });
  } catch {
    return NextResponse.json({ error: 'db unavailable' }, { status: 500 });
  }
}
