import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { attachContentAssetSchema } from "@/lib/validations";
import { assertContentPermission } from "@/lib/content-permissions";
import { resolveContentTarget, isRevisionCapableKind, type ContentKind } from "@/lib/content";
import { NotFoundError } from "@/lib/permissions";

interface Params {
  params: Promise<{ kind: string; contentId: string }>;
}

/**
 * Dosya bağlama — `ContentAsset` yalnızca 4 üst düzey içerik türünde vardır
 * (bkz. proje talebi §13). `DailyWorkReport` seviyesinde değil, yalnızca
 * `DailyWorkItem` seviyesinde dosya eklenebilir (şemada `dailyWorkItemId`
 * alanı var, `dailyWorkReportId` YOK) — bu nedenle "daily-report" burada
 * `isRevisionCapableKind` ile AYNI kümeyle dışlanır.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { kind, contentId } = await params;
    const typedKind = kind as ContentKind;
    if (!isRevisionCapableKind(typedKind)) {
      return NextResponse.json({ error: "Bu içerik türü dosya bağlamayı desteklemiyor." }, { status: 400 });
    }
    const { fkField } = await resolveContentTarget(typedKind, contentId, session.user.id);

    const assets = await prisma.contentAsset.findMany({
      where: { [fkField]: contentId },
      include: {
        fileUpload: true,
        addedBy: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ assets });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { kind, contentId } = await params;
    const typedKind = kind as ContentKind;
    if (!isRevisionCapableKind(typedKind)) {
      return NextResponse.json({ error: "Bu içerik türü dosya bağlamayı desteklemiyor." }, { status: 400 });
    }
    const { fkField, permissions, teamId } = await resolveContentTarget(
      typedKind,
      contentId,
      session.user.id,
    );
    assertContentPermission(permissions.canUploadFiles, "Dosya ekleme yetkiniz yok.");

    const body = await req.json();
    const data = attachContentAssetSchema.parse(body);

    const fileUpload = await prisma.fileUpload.findUnique({ where: { id: data.fileUploadId } });
    if (!fileUpload) {
      throw new NotFoundError("Dosya bulunamadı.");
    }

    const asset = await prisma.contentAsset.create({
      data: {
        fileUploadId: data.fileUploadId,
        role: data.role ?? undefined,
        [fkField]: contentId,
        addedById: session.user.id,
      },
      include: {
        fileUpload: true,
        addedBy: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    await logActivity({
      teamId,
      userId: session.user.id,
      action: "CONTENT_ASSET_ADDED",
      module: "CONTENT",
      message: `Bir içeriğe "${fileUpload.title || fileUpload.fileName || "dosya"}" eklendi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
