import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reorderTasksSchema } from "@/lib/validations";
import { requireColumnAccess } from "@/lib/permissions";
import { handleApiError, unauthorized } from "@/lib/api-helpers";

/**
 * Bir sütun içindeki (veya sütunlar arası taşımadan sonraki hedef
 * sütundaki) görevlerin tam sıralı listesini alır; her görevin
 * `columnId`sini bu sütuna, `position`ını dizideki index'e eşitler.
 * Sürükle-bırakta hem "aynı sütun içinde sırala" hem "başka sütuna taşı"
 * senaryosu, istemcinin etkilenen sütun(lar) için bu uca ayrı ayrı
 * çağrı yapmasıyla karşılanır (kaynak sütun boşalan yerler için, hedef
 * sütun yeni sıra için).
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const body = await req.json();
    const data = reorderTasksSchema.parse(body);

    const { column: targetColumn } = await requireColumnAccess(data.columnId, session.user.id);

    // completedAt yalnızca GERÇEKTEN bu sütuna taşınan görevler için
    // güncellenir — zaten bu sütunda olup sadece yeniden sıralanan
    // görevlere dokunulmaz.
    const existingTasks = await prisma.task.findMany({
      where: { id: { in: data.taskIds } },
      select: { id: true, columnId: true },
    });
    const previousColumnById = new Map(existingTasks.map((t) => [t.id, t.columnId]));

    await prisma.$transaction(
      data.taskIds.map((id, index) => {
        const movedIntoColumn = previousColumnById.get(id) !== data.columnId;
        return prisma.task.update({
          where: { id },
          data: {
            columnId: data.columnId,
            position: index,
            ...(movedIntoColumn
              ? { completedAt: targetColumn.isDoneColumn ? new Date() : null }
              : {}),
          },
        });
      }),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
