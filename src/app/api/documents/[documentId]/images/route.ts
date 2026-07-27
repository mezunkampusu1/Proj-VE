import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireDocumentAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { saveFile } from "@/lib/storage";

interface Params {
  params: Promise<{ documentId: string }>;
}

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"]);

/**
 * Doküman gövdesine (Ortak Alan editörü) bilgisayardan görsel yükleme
 * uç noktası — görev #190: önceden yalnızca URL ile görsel eklenebiliyordu.
 * Yüklenen dosya mevcut yerel disk depolama katmanına (saveFile — Dosyalar
 * ve Görev Ekleri modülleriyle PAYLAŞILAN altyapı) kaydedilir. Bilinçli
 * basitleştirme: bu görseller için ayrı bir veritabanı kaydı TUTULMAZ —
 * dönen URL doğrudan editör içeriğine (Yjs) gömülür. Bir görsel dokümandan
 * kaldırılırsa diskteki dosya otomatik silinmez (yetim kalır); ayrı bir
 * temizlik/garbage-collection akışı bu kapsamda değildir.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    await requireDocumentAccess(documentId, session.user.id, "EDITOR");

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Görsel dosyası bulunamadı." }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Yalnızca PNG, JPEG, GIF, WEBP veya SVG görselleri yüklenebilir." },
        { status: 400 },
      );
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json({ error: "Görsel en fazla 8 MB olabilir." }, { status: 400 });
    }

    const saved = await saveFile(file);
    return NextResponse.json(
      { url: `/api/documents/${documentId}/images/${saved.storedPath}` },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
