import { NextResponse } from 'next/server';
import { recordAndSave } from '@/lib/db';

// Same Node.js runtime rationale as app/api/stats/route.ts: @libsql/client's
// native sqlite module needs Node built-ins (`node:fs`, `node:path`), and
// Next.js 16 deprecates the Edge runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Server-authoritative outcome recording: the client only names who won
 * ('X' | 'O' | 'draw'); this handler reads the current row, applies the pure
 * `recordOutcome` rule, and writes the new full row back via `recordAndSave`.
 */
function isOutcome(v: unknown): v is { outcome: 'X' | 'O' | 'draw' } {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return r.outcome === 'X' || r.outcome === 'O' || r.outcome === 'draw';
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!isOutcome(body)) {
    return NextResponse.json({ error: 'invalid outcome shape' }, { status: 422 });
  }
  try {
    const next = await recordAndSave(body.outcome);
    return NextResponse.json({ stats: next });
  } catch {
    return NextResponse.json({ error: 'db unavailable' }, { status: 500 });
  }
}
