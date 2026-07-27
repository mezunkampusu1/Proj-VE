import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { saveFile, MAX_FILE_SIZE_BYTES } from "@/lib/storage";
import { createFileMetaSchema } from "@/lib/validations";
import { logActivity, notifyUser } from "@/lib/activity";

const fileInclude = {
  uploadedBy: { select: { id: true, name: true, email: true } },
  university: { select: { id: true, name: true } },
  mentions: { include: { user: { select: { id: true, name: true, email: true } } } },
} as const;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);

    // Görünürlük kuralı (kullanıcı talebi, netleştirilmiş: "sadece
    // etiketlenen kişiler görsün, kendim dosya attım etiketlemedim ama
    // karşı taraf görebildi" — daha önceki "kimse etiketlenmezse genel depo
    // gibi herkese açık kalsın" yorumu YANLIŞ çıktı, kullanıcı bunu açıkça
    // düzeltti). Artık Görevler/Projeler modülündeki AYNI kural: kimse
    // etiketlenmediyse yalnızca yükleyen (+ admin) görür; en az bir kişi
    // etiketlendiyse yükleyen + etiketlenenler + admin görür.
    const files = await prisma.fileUpload.findMany({
      where:
        membership.role === "ADMIN"
          ? undefined
          : {
              OR: [
                { uploadedById: session.user.id },
                { mentions: { some: { userId: session.user.id } } },
              ],
            },
      include: fileInclude,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ files });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const formData = await req.formData();
    const file = formData.get("file");
    const mentionedUserIdsRaw = formData.get("mentionedUserIds");

    const meta = createFileMetaSchema.parse({
      kind: formData.get("kind") || "UPLOAD",
      title: formData.get("title") || undefined,
      description: formData.get("description") || undefined,
      externalUrl: formData.get("externalUrl") || undefined,
      universityId: formData.get("universityId") || undefined,
      mentionedUserIds:
        typeof mentionedUserIdsRaw === "string" && mentionedUserIdsRaw
          ? (JSON.parse(mentionedUserIdsRaw) as string[])
          : undefined,
    });

    let saved: {
      fileName?: string;
      storedPath?: string;
      fileSize?: number;
      mimeType?: string;
    } = {};

    if (meta.kind === "UPLOAD") {
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 400 });
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: "Dosya boyutu 25 MB'ı aşamaz." }, { status: 413 });
      }
      saved = await saveFile(file);
    }

    // Etiketlenen kişi kendisiyse ayrıca bildirim gönderilmez (kendine
    // bildirim anlamsız — bkz. task atama/mention akışlarındaki aynı desen).
    const uniqueMentionedUserIds = Array.from(
      new Set((meta.mentionedUserIds ?? []).filter((id) => id !== session.user.id)),
    );

    const record = await prisma.fileUpload.create({
      data: {
        kind: meta.kind,
        title: meta.title?.trim() || null,
        description: meta.description ?? undefined,
        externalUrl: meta.kind === "LINK" ? meta.externalUrl : undefined,
        fileName: saved.fileName,
        storedPath: saved.storedPath,
        fileSize: saved.fileSize,
        mimeType: saved.mimeType,
        universityId: meta.universityId || undefined,
        uploadedById: session.user.id,
        mentions: uniqueMentionedUserIds.length
          ? { create: uniqueMentionedUserIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: fileInclude,
    });

    const displayName = record.title || record.fileName || record.externalUrl;

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "FILE_UPLOADED",
      module: "FILES",
      message: `"${displayName}" dosyası eklendi.`,
    });

    await Promise.all(
      uniqueMentionedUserIds.map((userId) =>
        notifyUser({
          userId,
          type: "FILE_MENTIONED",
          title: "Bir dosyada etiketlendiniz",
          message: `"${displayName}" dosyasında etiketlendiniz.`,
          link: `/files?open=${record.id}`,
        }),
      ),
    );

    return NextResponse.json({ file: record }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
