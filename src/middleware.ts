import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const AUTH_ONLY_PATHS = ["/login", "/register"];
const ALWAYS_PUBLIC_PATHS = ["/share", "/api/public"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isAuthPage = AUTH_ONLY_PATHS.some((p) => pathname.startsWith(p));
  const isAlwaysPublic = ALWAYS_PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isAuthed = !!req.auth;

  if (!isAuthed && !isAuthPage && !isAlwaysPublic) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthed && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Şunlar dışındaki tüm istek yollarını eşleştir:
     * - api/auth (NextAuth uç noktaları)
     * - _next/static, _next/image (statik dosyalar)
     * - favicon.ico, public dosyalar
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
