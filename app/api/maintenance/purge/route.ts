import { NextResponse } from 'next/server';
import { purgeStaleRooms } from '@/lib/db';
import { problemResponse } from '@/lib/api-problem';

// T-N3 (ulw-room-lifecycle-20260924 §二 T-N3) — TTL 自动回收的维护端点。
//
//   POST / GET /api/maintenance/purge
//     Authorization: Bearer ${CRON_SECRET}
//       → 200 application/json { deletedCount, cutoffDays }
//       → 401 problem+json unauthorized — 缺失 / 不匹配 / 非 Bearer scheme
//       → 500 problem+json db-unavailable — service 抛错
//
// 鉴权：单 secret Bearer 比较（CRON_SECRET 经 Vercel Dashboard 注入环境
// 变量；不入仓不入探针——见 docs/operations.md 「运维·TTL 回收」节）。
// 与 merge/outcomes 等五端点不同：本端点不接受任何业务输入，仅接收 secret
// 鉴权头；payload 全部 default (30 天不活跃)。
//
// Vercel Cron 在 Hobby plan 上以 GET 形式命中（POST 也接受）；本路由
// POST/GET 共 handler 同步覆盖。vercel.json 注册见 `crons` 字段，调度
// 详情见 docs/operations.md。
//
// 业务逻辑在 lib/db.ts:purgeStaleRooms（withWriteLock + db.transaction
// 包 DELETE WHERE updated_at < :cutoff，返回 {deletedCount, cutoffDays}）。
// transport 只做：鉴权 → 调 service → 把 service 返回值原样 JSON 200。

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Bearer token comparison that returns 401 on any of: missing
 * Authorization header, wrong scheme (not Bearer), or token mismatch.
 * Constant-time compare prevents trivial timing leaks of CRON_SECRET
 * length / prefix over repeated probes (defense in depth; the secret
 * is also rate-limited by Vercel Cron's own schedule).
 */
function authorize(request: Request): Response | null {
  const header = request.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return problemResponse(401, 'unauthorized');
  }
  const token = header.slice('Bearer '.length);
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length === 0) {
    // Server misconfig: refuse rather than allow unauthenticated purge.
    return problemResponse(401, 'unauthorized');
  }
  if (token.length !== expected.length) {
    return problemResponse(401, 'unauthorized');
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (diff !== 0) {
    return problemResponse(401, 'unauthorized');
  }
  return null;
}

export async function POST(request: Request): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;
  try {
    const result = await purgeStaleRooms(30);
    return NextResponse.json(result);
  } catch {
    return problemResponse(500, 'db-unavailable');
  }
}

export async function GET(request: Request): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;
  try {
    const result = await purgeStaleRooms(30);
    return NextResponse.json(result);
  } catch {
    return problemResponse(500, 'db-unavailable');
  }
}
