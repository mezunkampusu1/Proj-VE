import jwt, { type JwtPayload } from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import type { PMNode } from "@/lib/document-export";

/**
 * `/share/[token]` (dış, oturumsuz paylaşım görünümü) ve onun görsel alt
 * kaynakları için ortak güvenlik mantığı. Hem `/api/public/documents/[token]`
 * hem de `/api/public/documents/[token]/images/[storedPath]` bu modülü
 * kullanır — token geçerliliği, şifre-doğrulama çerezi ve gömülü görsel
 * beyaz listesi tek yerden yönetilir.
 *
 * `saveFile()` (bkz. src/lib/storage.ts) yüklenen görseller için ayrı bir
 * veritabanı kaydı tutmaz; bu yüzden "bu storedPath gerçekten bu dokümana
 * mı ait" sorusu, dokümanın GÜNCEL `content` JSON'ı yapısal olarak
 * gezilerek (regex ile serbest metin taraması DEĞİL) her istekte
 * doğrulanır — bkz. extractEmbeddedImagePaths.
 */

export const STORED_PATH_PATTERN = /^[a-f0-9-]{36}\.[a-zA-Z0-9]+$/;

const SHARE_JWT_PURPOSE = "public-share-access" as const;
export const SHARE_PASSWORD_COOKIE_NAME = "share_pw_ok";
const SHARE_PASSWORD_COOKIE_MAX_AGE_SECONDS = 30 * 60;

interface ShareAccessPayload {
  token: string;
  documentId: string;
  purpose: typeof SHARE_JWT_PURPOSE;
}

export interface SharedDocumentRecord {
  id: string;
  title: string;
  content: PMNode;
  status: string;
  updatedAt: Date;
  deletedAt: Date | null;
  publicShareExpiresAt: Date | null;
  publicSharePasswordHash: string | null;
  owner: { name: string | null; email: string | null };
}

/**
 * Ekip dışı, OTURUMSUZ erişim için token doğrulaması (§22). Yetkilendirme
 * yalnızca token'ın geçerliliğine (süresi dolmamış, doküman silinmemiş)
 * dayanır.
 */
export async function loadShared(token: string): Promise<SharedDocumentRecord | null> {
  const document = await prisma.document.findUnique({
    where: { publicShareToken: token },
    select: {
      id: true,
      title: true,
      content: true,
      status: true,
      updatedAt: true,
      deletedAt: true,
      publicShareExpiresAt: true,
      publicSharePasswordHash: true,
      owner: { select: { name: true, email: true } },
    },
  });
  if (!document || document.deletedAt) return null;
  if (document.publicShareExpiresAt && document.publicShareExpiresAt < new Date()) return null;
  return document as unknown as SharedDocumentRecord;
}

function internalImageSrcPrefix(documentId: string): string {
  return `/api/documents/${documentId}/images/`;
}

/**
 * Bir dokümanın GÜNCEL içeriğinde gömülü, gerçekten o dokümana ait
 * görsellerin `storedPath` kümesini döner. JSON ağacı yapısal olarak
 * gezilir (node.type === "image" kontrolü) — serileştirilmiş JSON metni
 * üzerinde regex taraması yapılmaz.
 */
export function extractEmbeddedImagePaths(content: PMNode, documentId: string): Set<string> {
  const prefix = internalImageSrcPrefix(documentId);
  const found = new Set<string>();

  function walk(node: PMNode | undefined | null): void {
    if (!node) return;
    if (node.type === "image" && typeof node.attrs?.src === "string") {
      const src = node.attrs.src;
      if (src.startsWith(prefix)) {
        const storedPath = src.slice(prefix.length);
        if (STORED_PATH_PATTERN.test(storedPath)) {
          found.add(storedPath);
        }
      }
    }
    for (const child of node.content || []) walk(child);
  }

  walk(content);
  return found;
}

/**
 * `content` içindeki korumalı görsel URL'lerini (`/api/documents/...`),
 * token-scoped public uç noktasına (`/api/public/documents/[token]/images/...`)
 * çevirir. İstemciye (PublicShareView) hiçbir zaman korumalı URL sızmaz.
 */
export function rewriteImageUrlsForPublicShare(content: PMNode, documentId: string, token: string): PMNode {
  const prefix = internalImageSrcPrefix(documentId);
  const publicPrefix = `/api/public/documents/${token}/images/`;

  function rewrite(node: PMNode): PMNode {
    const next: PMNode = { ...node };
    if (next.type === "image" && typeof next.attrs?.src === "string" && next.attrs.src.startsWith(prefix)) {
      const storedPath = next.attrs.src.slice(prefix.length);
      if (STORED_PATH_PATTERN.test(storedPath)) {
        next.attrs = { ...next.attrs, src: `${publicPrefix}${storedPath}` };
      }
    }
    if (next.content) next.content = next.content.map(rewrite);
    return next;
  }

  return rewrite(content);
}

/** COLLAB_SECRET'tan kasıtlı olarak bağımsız — amaca özel, ayrı bir secret. */
export function getShareSecret(): string | null {
  return process.env.SHARE_SECRET || null;
}

/** Çerez ömrünü, sabit tavan (30 dk) ile paylaşımın kalan süresinin küçüğüne sabitler. */
export function computeShareCookieMaxAgeSeconds(publicShareExpiresAt: Date | null): number {
  if (!publicShareExpiresAt) return SHARE_PASSWORD_COOKIE_MAX_AGE_SECONDS;
  const secondsUntilExpiry = Math.floor((publicShareExpiresAt.getTime() - Date.now()) / 1000);
  return Math.max(0, Math.min(SHARE_PASSWORD_COOKIE_MAX_AGE_SECONDS, secondsUntilExpiry));
}

/** SHARE_SECRET yoksa çağıran taraf açıkça hata döndürmelidir — burada sessiz fallback yoktur. */
export function signSharePasswordCookie(payload: { token: string; documentId: string }, maxAgeSeconds: number): string {
  const secret = getShareSecret();
  if (!secret) throw new Error("SHARE_SECRET yapılandırılmamış.");
  const body: ShareAccessPayload = { ...payload, purpose: SHARE_JWT_PURPOSE };
  return jwt.sign(body, secret, { expiresIn: maxAgeSeconds });
}

export function verifySharePasswordCookie(cookieValue: string, expected: { token: string; documentId: string }): boolean {
  const secret = getShareSecret();
  if (!secret) return false;
  try {
    const decoded = jwt.verify(cookieValue, secret);
    if (typeof decoded === "string") return false;
    const payload = decoded as JwtPayload & Partial<ShareAccessPayload>;
    return (
      payload.purpose === SHARE_JWT_PURPOSE &&
      payload.token === expected.token &&
      payload.documentId === expected.documentId
    );
  } catch {
    return false;
  }
}

/** `Cookie` başlığından tek bir çerezi okur (bu route grubu `NextRequest` yerine `Request` tipini kullanıyor). */
export function readCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) continue;
    const key = part.slice(0, eqIndex).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(eqIndex + 1).trim());
    }
  }
  return null;
}
