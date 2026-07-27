import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { assertContentPermission } from "@/lib/content-permissions";
import { z } from "zod";

interface Params {
  params: Promise<{ brandId: string }>;
}

const updateBrandSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { brandId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    assertContentPermission(membership.role === "ADMIN", "Marka düzenleme yetkiniz yok.");

    const body = await req.json();
    const data = updateBrandSchema.parse(body);

    const brand = await prisma.contentBrand.update({ where: { id: brandId }, data });
    return NextResponse.json({ brand });
  } catch (error) {
    return handleApiError(error);
  }
}
