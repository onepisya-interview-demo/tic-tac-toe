import { NextResponse } from 'next/server';
import { loadStats, saveStats, resetStats } from '@/lib/db';
import { type GameStats } from '@/lib/game';

// Force this route to run on the Node.js runtime — better-sqlite3 needs it.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isGameStats(v: unknown): v is GameStats {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.totalGames === 'number' &&
    typeof r.xWins === 'number' &&
    typeof r.oWins === 'number' &&
    typeof r.draws === 'number' &&
    typeof r.currentStreak === 'number'
  );
}

export async function GET() {
  const stats = loadStats();
  return NextResponse.json(stats);
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!isGameStats(body)) {
    return NextResponse.json({ error: 'invalid stats shape' }, { status: 400 });
  }
  saveStats(body);
  return NextResponse.json(body);
}

export async function DELETE() {
  const zero = resetStats();
  return NextResponse.json(zero);
}
