import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";

interface Params {
  params: Promise<{ typeId: string }>;
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { typeId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    await prisma.announcementType.delete({ where: { id: typeId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Prisma'nın "yabancı anahtar kısıtlaması" hatasını (P2003), üretilen
    // istemci tipine bağımlı olmadan (duck-typing ile) yakalar — bu türe
    // bağlı duyurular varken silme engellenir.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2003"
    ) {
      return NextResponse.json(
        { error: "Bu türe bağlı duyurular var, önce onları silin veya türünü değiştirin." },
        { status: 409 },
      );
    }
    return handleApiError(error);
  }
}
