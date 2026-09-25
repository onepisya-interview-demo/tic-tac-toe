import { NextResponse } from 'next/server';
import { deleteRoomByRoom } from '@/lib/db';
import { normalizeRoom } from '@/lib/room-name';
import { problemResponse } from '@/lib/api-problem';

// T-N1 (ulw-room-lifecycle-20260924 §二 T-N1) thin transport wrapper.
//
//   DELETE /api/rooms/{room}
//     → 200 { ok: true }                — row 删除成功
//     → 404 room-not-found (新增 slug, problem+json) — 行不存在
//     → 422 invalid-room-name           — room 不在 whitelist
//     → 500 db-unavailable              — service 抛错
//
// 与 POST /api/rooms（幂等进入）资源级对称：DELETE 是资源销毁的等价动词，
// AGENTS.md §本项目反模式 里 D-2 「动作端点家族」惯例不再抑制 DELETE
// 资源语义——本票即 W1 后首次正当的 DELETE 用法（详见 plan §一）。
//
// 业务逻辑在 lib/db.ts:deleteRoomByRoom（withWriteLock + db.transaction
// 包 DELETE 行）；本路由只做：解析 room → 调 service → 把具名结果映射成
// status code。详尽 service/transport 分离契约见 lib/db.ts 顶部 doc 与
// AGENTS.md。
//
// 行不存在映射 404（而非 200 幂等）：与 resetRecordByRoom / outcomes 同款
// 「防静默建档」纪律，404 让调用方区分「原本就没这房间」与「已成功删除」。
// 调用方（result 页 type-to-confirm 删除按钮）按契约把 404 当成功继续本地
// 清零（plan §二 T-N2）；本路由不替调用方做该决定，只如实回报。

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ room: string }> },
): Promise<Response> {
  const { room: raw } = await params;
  const room = normalizeRoom(decodeURIComponent(raw));
  if (room === null) {
    return problemResponse(422, 'invalid-room-name');
  }
  try {
    const result = await deleteRoomByRoom(room);
    if (!result.ok) {
      return problemResponse(
        404,
        'room-not-found',
        `No row for room "${room}". Enter or create the room before deleting it.`,
      );
    }
    return NextResponse.json({ ok: true });
  } catch {
    return problemResponse(500, 'db-unavailable');
  }
}
