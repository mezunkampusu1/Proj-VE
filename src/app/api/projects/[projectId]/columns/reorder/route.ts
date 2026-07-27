import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reorderColumnsSchema } from "@/lib/validations";
import { requireProjectAccess } from "@/lib/permissions";
import { handleApiError, unauthorized } from "@/lib/api-helpers";

interface Params {
  params: Promise<{ projectId: string }>;
}

/**
 * Sütunların yeni sırasını tek seferde uygular — istemci sürükle-bırak
 * sonrası tam sıralı columnId dizisini gönderir, sunucu her birinin
 * `order`ını dizideki index'e eşitler. Kısmi/parçalı reorder yerine bu
 * basit "tam liste" yaklaşımı, pozisyon çakışması riskini ortadan kaldırır.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { projectId } = await params;
    await requireProjectAccess(projectId, session.user.id);

    const body = await req.json();
    const data = reorderColumnsSchema.parse(body);

    await prisma.$transaction(
      data.columnIds.map((id, index) =>
        prisma.taskColumn.update({
          where: { id, projectId },
          data: { order: index },
        }),
      ),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
