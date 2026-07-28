import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword } from "@/lib/password";
import { getClientIp } from "@/lib/activity";
import { isRateLimited, recordFailure, resetRateLimit } from "@/lib/rate-limit";
import {
  loadShared,
  rewriteImageUrlsForPublicShare,
  getShareSecret,
  signSharePasswordCookie,
  computeShareCookieMaxAgeSeconds,
  SHARE_PASSWORD_COOKIE_NAME,
} from "@/lib/public-share";
import type { PMNode } from "@/lib/document-export";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

interface Params {
  params: Promise<{ token: string }>;
}

/** GET: Bağlantının geçerliliğini ve şifre gerekip gerekmediğini döner (içerik olmadan). */
export async function GET(_req: Request, { params }: Params) {
  const { token } = await params;
  const document = await loadShared(token);
  if (!document) {
    return NextResponse.json({ error: "Bağlantı geçersiz veya süresi dolmuş." }, { status: 404 });
  }

  if (document.publicSharePasswordHash) {
    return NextResponse.json({ requiresPassword: true });
  }

  const content = (document.content as PMNode | null) || { type: "doc", content: [] };
  return NextResponse.json({
    requiresPassword: false,
    title: document.title,
    content: rewriteImageUrlsForPublicShare(content, document.id, token),
    status: document.status,
    updatedAt: document.updatedAt,
    owner: document.owner,
  });
}

const passwordSchema = z.object({ password: z.string().min(1) });

/** POST: Şifreli bağlantılar için şifreyi doğrular, başarılıysa içeriği döner. */
export async function POST(req: Request, { params }: Params) {
  const { token } = await params;
  const document = await loadShared(token);
  if (!document) {
    return NextResponse.json({ error: "Bağlantı geçersiz veya süresi dolmuş." }, { status: 404 });
  }
  if (!document.publicSharePasswordHash) {
    return NextResponse.json({ error: "Bu bağlantı şifre gerektirmiyor." }, { status: 400 });
  }

  const shareSecret = getShareSecret();
  if (!shareSecret) {
    return NextResponse.json(
      { error: "Paylaşım erişimi yapılandırılmamış (SHARE_SECRET eksik)." },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = passwordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Şifre gerekli." }, { status: 400 });
  }

  const rateLimitKey = `${getClientIp(req) ?? "unknown"}:${token}`;
  if (isRateLimited(rateLimitKey, RATE_LIMIT_MAX_ATTEMPTS, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Çok fazla başarısız deneme. Lütfen 15 dakika sonra tekrar deneyin." },
      { status: 429 },
    );
  }

  const valid = await verifyPassword(parsed.data.password, document.publicSharePasswordHash);
  if (!valid) {
    recordFailure(rateLimitKey, RATE_LIMIT_WINDOW_MS);
    return NextResponse.json({ error: "Şifre yanlış." }, { status: 403 });
  }

  resetRateLimit(rateLimitKey);

  const content = (document.content as PMNode | null) || { type: "doc", content: [] };
  const response = NextResponse.json({
    requiresPassword: false,
    title: document.title,
    content: rewriteImageUrlsForPublicShare(content, document.id, token),
    status: document.status,
    updatedAt: document.updatedAt,
    owner: document.owner,
  });

  const maxAgeSeconds = computeShareCookieMaxAgeSeconds(document.publicShareExpiresAt);
  if (maxAgeSeconds > 0) {
    const cookieValue = signSharePasswordCookie({ token, documentId: document.id }, maxAgeSeconds);
    response.cookies.set(SHARE_PASSWORD_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: `/api/public/documents/${token}`,
      maxAge: maxAgeSeconds,
    });
  }

  return response;
}
