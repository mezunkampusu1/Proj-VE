import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { PermissionError, NotFoundError } from "@/lib/permissions";
import { AIConfigError } from "@/lib/ai";

/**
 * API route handler'larda try/catch içinden çağrılır; bilinen hata
 * tiplerini uygun HTTP durum koduna çevirir.
 */
export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Geçersiz veri", details: error.flatten() },
      { status: 400 },
    );
  }
  if (error instanceof PermissionError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof AIConfigError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  console.error(error);
  return NextResponse.json(
    { error: "Beklenmeyen bir hata oluştu." },
    { status: 500 },
  );
}

export function unauthorized() {
  return NextResponse.json({ error: "Giriş yapmanız gerekiyor." }, { status: 401 });
}
