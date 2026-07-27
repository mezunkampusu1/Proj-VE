import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireTaskAccess } from "@/lib/permissions";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { saveFile } from "@/lib/storage";

interface Params {
  params: Promise<{ taskId: string }>;
}

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"]);

/**
 * Görevlendirme #200: zengin metin yorum editörüne bilgisayardan resim
 * yükleme uç noktası — Ortak Alan'daki doküman görsel yükleme deseninin
 * (src/app/api/documents/[documentId]/images/route.ts) birebir aynısı,
 * yalnızca yetkilendirme görev erişimine (requireTaskAccess) bağlanmış
 * hâli. Ayrı bir veritabanı kaydı tutulmaz — dönen URL doğrudan yorumun
 * bodyJson içeriğine (Tiptap) gömülür.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { taskId } = await params;
    await requireTaskAccess(taskId, session.user.id);

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
      { url: `/api/tasks/${taskId}/comment-images/${saved.storedPath}` },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
