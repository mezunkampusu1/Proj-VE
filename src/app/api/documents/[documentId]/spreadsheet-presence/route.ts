import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireDocumentAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { updateSpreadsheetPresenceSchema } from "@/lib/validations";
import { colorForUserId } from "@/lib/collab-client";
import {
  getSpreadsheetPresences,
  removeSpreadsheetPresence,
  setSpreadsheetPresence,
} from "@/lib/spreadsheet-presence";

interface Params {
  params: Promise<{ documentId: string }>;
}

/**
 * "Şu Anda Burada" / canlı hücre imleci — kullanıcı talebi: "Word'de bunu
 * görebiliyorduk, Excel'de de olur mu?". fortune-sheet'in kendi Presence
 * API'sini (bkz. spreadsheet-editor.tsx, addPresences/removePresences)
 * besleyen hafif bir uç nokta. Kalıcı bir kayıt DEĞİL — bkz.
 * lib/spreadsheet-presence.ts. Mevcut ops yoklama döngüsüyle (1.5sn) aynı
 * ritimde çalışır; ayrı bir WebSocket/awareness altyapısı gerektirmez.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    await requireDocumentAccess(documentId, session.user.id, "VIEWER");

    const body = await req.json();
    const data = updateSpreadsheetPresenceSchema.parse(body);

    setSpreadsheetPresence(documentId, {
      userId: session.user.id,
      name: session.user.name || session.user.email || "Kullanıcı",
      color: colorForUserId(session.user.id),
      sheetId: data.sheetId,
      row: data.row,
      column: data.column,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    await requireDocumentAccess(documentId, session.user.id, "VIEWER");

    const presences = getSpreadsheetPresences(documentId, session.user.id);
    return NextResponse.json({ presences });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Sekme kapanırken/dokümandan çıkarken en iyi çaba ("best effort") ile
 * kendi imlecini hemen kaldırır — atlanırsa TTL zaten birkaç saniyede
 * kendiliğinden temizler (bkz. lib/spreadsheet-presence.ts). */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { documentId } = await params;
    removeSpreadsheetPresence(documentId, session.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
