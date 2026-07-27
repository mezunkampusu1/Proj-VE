import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireDocumentAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { readStoredFile } from "@/lib/storage";

interface Params {
  params: Promise<{ documentId: string; storedPath: string }>;
}

// saveFile() daima "<uuid>.<uzanti>" biçiminde bir ad üretir (bkz. src/lib/storage.ts).
// Bu route'a gelen storedPath URL'den (kullanıcı girdisinden) geldiği için, diskteki
// UPLOADS_DIR dışına çıkan bir yol (path traversal) oluşturulamadığından emin olmak
// için bu kalıpla eşleşmeyen istekler reddedilir.
const STORED_PATH_PATTERN = /^[a-f0-9-]{36}\.[a-zA-Z0-9]+$/;

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

/**
 * Doküman gövdesine gömülü bir görseli sunar (`<img src>` bunu doğrudan
 * kullanır). Erişim, dokümanın kendi yetkilendirmesiyle aynı kurala
 * bağlıdır — dokümana erişimi olmayan biri görseli de göremez.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId, storedPath } = await params;
    await requireDocumentAccess(documentId, session.user.id, "VIEWER");

    if (!STORED_PATH_PATTERN.test(storedPath)) {
      return NextResponse.json({ error: "Geçersiz görsel yolu." }, { status: 400 });
    }

    const buffer = await readStoredFile(storedPath);
    const ext = storedPath.split(".").pop()?.toLowerCase() || "";
    const contentType = CONTENT_TYPE_BY_EXT[ext] || "application/octet-stream";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
