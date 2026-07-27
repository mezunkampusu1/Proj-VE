import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

interface Params {
  params: Promise<{ token: string }>;
}

/**
 * Ekip dışı, OTURUMSUZ erişim uç noktası (§22). Kasıtlı olarak `auth()`
 * çağırmaz — bu, dış paylaşım bağlantısının tüm amacıdır. Yetkilendirme
 * yalnızca token'ın geçerliliğine (süresi dolmamış, doküman silinmemiş)
 * ve varsa şifreye dayanır.
 */
async function loadShared(token: string) {
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
  return document;
}

/** GET: Bağlantının geçerliliğini ve şifre gerekip gerekmediğini döner (içerik olmadan). */
export async function GET(_req: Request, { params }: Params) {
  const { token } = await params;
  const document = await loadShared(token);
  if (!document) {
    return NextResponse.json({ error: "Bağlantı geçersiz veya süresi dolmuş." }, { status: 404 });
  }

  if (document.publicSharePasswordHash) {
    return NextResponse.json({ requiresPassword: true, title: document.title });
  }

  return NextResponse.json({
    requiresPassword: false,
    title: document.title,
    content: document.content,
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

  const body = await req.json().catch(() => ({}));
  const parsed = passwordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Şifre gerekli." }, { status: 400 });
  }

  const valid = await verifyPassword(parsed.data.password, document.publicSharePasswordHash);
  if (!valid) {
    return NextResponse.json({ error: "Şifre yanlış." }, { status: 403 });
  }

  return NextResponse.json({
    requiresPassword: false,
    title: document.title,
    content: document.content,
    status: document.status,
    updatedAt: document.updatedAt,
    owner: document.owner,
  });
}
