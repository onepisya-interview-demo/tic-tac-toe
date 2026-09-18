import { NextResponse } from 'next/server';
import { isPlayerName } from '@/lib/player-name';
import { registerOrLoginName } from '@/lib/db';
import type { GameStats } from '@/lib/game';

// Node.js runtime — @libsql/client's native sqlite module needs Node
// built-ins (`node:fs`, `node:path`); same rationale as the other
// lib/db.ts-backed routes in this repo (app/api/stats/route.ts,
// app/api/solo-stats/route.ts). force-dynamic so RSC pages reading
// fresh player-session state never bake build-time rows into HTML
// (AGENTS 反模式: RSC reads mutable data must declare force-dynamic).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Body shape: just { name }. Mirrors app/api/solo-stats/route.ts's
// PUT isSoloNameBody guard — accepts nothing but the trimmed name
// key so a future client cannot smuggle a full stats row through
// this endpoint by mistake (defensive against a W3 caller that
// might get tempted to put stats in the same payload).
function isPlayerSessionBody(v: unknown): v is { name: string } {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  if (typeof r.name !== 'string') return false;
  for (const k of Object.keys(r)) {
    if (k !== 'name') return false;
  }
  return true;
}

interface RegisterResponse {
  stats: GameStats;
  existed: boolean;
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!isPlayerSessionBody(body)) {
    return NextResponse.json(
      { error: 'invalid request shape' },
      { status: 422 },
    );
  }
  // Single source of truth for the whitelist: lib/player-name.ts's
  // isPlayerName (mirror of app/api/solo-stats/route.ts's normalizeName)
  // — trim → 1–24 chars → reject control chars. isPlayerName is a
  // type guard; on true the input has already passed every check, so
  // we re-trim here to get the canonical PK value (the guard validates
  // but does not return the trimmed string).
  if (!isPlayerName(body.name)) {
    return NextResponse.json(
      { error: 'invalid player name' },
      { status: 422 },
    );
  }
  const name = body.name.trim();
  try {
    const result = await registerOrLoginName(name);
    const payload: RegisterResponse = {
      stats: result.stats,
      existed: result.existed,
    };
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: 'db unavailable' }, { status: 500 });
  }
}
