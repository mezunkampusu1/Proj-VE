import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { editDailyFlowEntrySchema } from "@/lib/validations";
import { logActivity, getClientIp } from "@/lib/activity";
import { formatTime, dailyFlowFieldLabel } from "@/lib/utils";
import { computeDurations, notifyAdminsForDailyFlowEvent } from "@/lib/daily-flow";

interface Params {
  params: Promise<{ entryId: string }>;
}

/**
 * PATCH: Yöneticinin bir kayıt üzerinde başlangıç/bitiş saati veya notu
 * düzeltmesi. Her değişen alan için eski/yeni değer çifti DailyFlowEdit'e
 * kalıcı olarak yazılır — eski kayıt asla silinmez (bkz. proje kuralı §7).
 * `completedAt` ilk kez bu uçtan girilirse ("eksik bitiş kaydını
 * tamamlama") kayıt otomatik olarak COMPLETED'e geçer ve süreler yeniden
 * hesaplanır.
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const { entryId } = await params;
    const body = await req.json();
    const data = editDailyFlowEntrySchema.parse(body);

    const entry = await prisma.dailyFlowEntry.findUnique({
      where: { id: entryId },
      include: { breaks: true, user: { select: { id: true, name: true, email: true } } },
    });
    if (!entry) throw new NotFoundError("Günlük Akış kaydı bulunamadı.");

    const editorName = session.user.name || session.user.email || "Yönetici";
    const edits: { field: string; oldValue: string | null; newValue: string | null }[] = [];
    const updateData: {
      startedAt?: Date;
      completedAt?: Date | null;
      note?: string | null;
      status?: "ACTIVE" | "ON_BREAK" | "COMPLETED";
      totalActiveSeconds?: number;
      totalBreakSeconds?: number;
      breakCount?: number;
    } = {};

    if (data.startedAt) {
      const newStartedAt = new Date(data.startedAt);
      if (newStartedAt.getTime() !== entry.startedAt.getTime()) {
        edits.push({
          field: "startedAt",
          oldValue: formatTime(entry.startedAt),
          newValue: formatTime(newStartedAt),
        });
        updateData.startedAt = newStartedAt;
      }
    }

    let willComplete = false;
    if (data.completedAt !== undefined) {
      const newCompletedAt = data.completedAt ? new Date(data.completedAt) : null;
      const oldTime = entry.completedAt?.getTime() ?? null;
      const newTime = newCompletedAt?.getTime() ?? null;
      if (oldTime !== newTime) {
        edits.push({
          field: "completedAt",
          oldValue: entry.completedAt ? formatTime(entry.completedAt) : "(boş)",
          newValue: newCompletedAt ? formatTime(newCompletedAt) : "(boş)",
        });
        updateData.completedAt = newCompletedAt;
        if (newCompletedAt && entry.status !== "COMPLETED") willComplete = true;
      }
    }

    if (data.note !== undefined && data.note !== entry.note) {
      edits.push({ field: "note", oldValue: entry.note, newValue: data.note ?? null });
      updateData.note = data.note ?? null;
    }

    if (edits.length === 0) {
      return NextResponse.json({ entry, message: "Değişiklik yok." });
    }

    if (willComplete) {
      const effectiveStartedAt = updateData.startedAt ?? entry.startedAt;
      const effectiveCompletedAt = updateData.completedAt ?? entry.completedAt!;
      const durations = computeDurations(
        { ...entry, startedAt: effectiveStartedAt, completedAt: effectiveCompletedAt, status: "ACTIVE" },
        effectiveCompletedAt,
      );
      updateData.status = "COMPLETED";
      updateData.totalActiveSeconds = durations.activeSeconds;
      updateData.totalBreakSeconds = durations.breakSeconds;
      updateData.breakCount = durations.closedBreakCount;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.dailyFlowEntry.update({ where: { id: entryId }, data: updateData });
      for (const e of edits) {
        await tx.dailyFlowEdit.create({
          data: {
            entryId,
            editedById: session.user.id,
            field: e.field,
            oldValue: e.oldValue,
            newValue: e.newValue,
            reason: data.reason,
          },
        });
      }
      return result;
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DAILY_FLOW_EDITED",
      module: "DAILY_FLOW",
      message: `${entry.user.name || entry.user.email} kullanıcısının Günlük Akış kaydını düzenledi.`,
      ipAddress: getClientIp(req),
    });

    const summary = edits
      .map((e) => `${dailyFlowFieldLabel(e.field)}, ${editorName} tarafından ${e.oldValue ?? "(boş)"}'den ${e.newValue ?? "(boş)"}'e güncellendi.`)
      .join(" ");
    await notifyAdminsForDailyFlowEvent({
      teamId: workspace.id,
      excludeUserId: session.user.id,
      eventKey: "onRecordEdited",
      title: "Günlük Akış kaydı düzenlendi",
      message: `${entry.user.name || entry.user.email} — ${summary}`,
      link: "/daily-flow/admin",
    });

    return NextResponse.json({ entry: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
