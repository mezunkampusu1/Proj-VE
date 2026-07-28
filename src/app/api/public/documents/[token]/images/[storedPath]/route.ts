import { NextResponse } from "next/server";
import {
  loadShared,
  extractEmbeddedImagePaths,
  getShareSecret,
  verifySharePasswordCookie,
  readCookieValue,
  SHARE_PASSWORD_COOKIE_NAME,
  STORED_PATH_PATTERN,
} from "@/lib/public-share";
import { readStoredFile } from "@/lib/storage";
import { handleApiError } from "@/lib/api-helpers";
import type { PMNode } from "@/lib/document-export";

interface Params {
  params: Promise<{ token: string; storedPath: string }>;
}

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

/**
 * `/share/[token]` görünümündeki doküman içeriğine gömülü görselleri
 * OTURUMSUZ sunar. Korumalı `/api/documents/[documentId]/images/[storedPath]`
 * route'undan (ve middleware.ts'ten) kasıtlı olarak bağımsızdır — o route
 * yalnızca `documentId`'ye bakar, token taşımaz, bu yüzden dış paylaşım
 * URL'lerine gömülemez. Erişim tamamen token'a ve (varsa) şifre
 * doğrulama çerezine bağlıdır; `documentId` burada hiç kullanılmaz.
 *
 * Kontrol sırası kasıtlıdır: en ucuz/riskli-en-az kontrol önce (format),
 * en pahalı/hassas kontrol en son (dosya okuma).
 */
export async function GET(req: Request, { params }: Params) {
  try {
    const { token, storedPath } = await params;

    if (!STORED_PATH_PATTERN.test(storedPath)) {
      return NextResponse.json({ error: "Geçersiz görsel yolu." }, { status: 400 });
    }

    const document = await loadShared(token);
    if (!document) {
      return NextResponse.json({ error: "Bağlantı geçersiz veya süresi dolmuş." }, { status: 404 });
    }

    if (document.publicSharePasswordHash) {
      const secret = getShareSecret();
      if (!secret) {
        return NextResponse.json(
          { error: "Paylaşım erişimi yapılandırılmamış (SHARE_SECRET eksik)." },
          { status: 503 },
        );
      }

      const cookieValue = readCookieValue(req.headers.get("cookie"), SHARE_PASSWORD_COOKIE_NAME);
      const isVerified =
        !!cookieValue && verifySharePasswordCookie(cookieValue, { token, documentId: document.id });
      if (!isVerified) {
        return NextResponse.json({ error: "Şifre doğrulaması gerekli." }, { status: 403 });
      }
    }

    const content = (document.content as PMNode | null) || { type: "doc", content: [] };
    const allowedPaths = extractEmbeddedImagePaths(content, document.id);
    if (!allowedPaths.has(storedPath)) {
      return NextResponse.json({ error: "Görsel bulunamadı." }, { status: 404 });
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
