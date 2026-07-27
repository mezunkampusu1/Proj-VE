import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { readStoredFile } from "@/lib/storage";
import { NotFoundError, PermissionError } from "@/lib/permissions";

interface Params {
  params: Promise<{ fileId: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { fileId } = await params;

    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);

    const file = await prisma.fileUpload.findUnique({
      where: { id: fileId },
      include: { mentions: { select: { userId: true } } },
    });
    if (!file) throw new NotFoundError("Dosya bulunamadı.");

    // Liste görünümündeki görünürlük kuralıyla aynı kontrol (bkz.
    // GET /api/files) — indirme linki dosya ID'sini bilen herkese açık
    // kalmasın diye burada da uygulanır. Kimse etiketlenmediyse yalnızca
    // yükleyen + admin indirebilir (kullanıcının netleştirdiği kural).
    const isVisible =
      membership.role === "ADMIN" ||
      file.uploadedById === session.user.id ||
      file.mentions.some((m) => m.userId === session.user.id);
    if (!isVisible) throw new PermissionError("Bu dosyaya erişim yetkiniz yok.");

    if (file.kind !== "UPLOAD" || !file.storedPath) {
      return NextResponse.json(
        { error: "Bu bir bağlantı kaydı — indirilecek bir dosya yok, bağlantıyı açın." },
        { status: 400 },
      );
    }

    const buffer = await readStoredFile(file.storedPath);
    const displayName = file.fileName || file.title || "dosya";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(displayName)}`,
        "Content-Length": String(file.fileSize ?? buffer.byteLength),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
