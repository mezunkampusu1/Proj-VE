import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin, requireTeamMember, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { adminCreateDailyFlowEntrySchema } from "@/lib/validations";
import { toDateOrUndefined } from "@/lib/dates";
import { logActivity, getClientIp } from "@/lib/activity";
import { formatTime, dailyFlowFieldLabel } from "@/lib/utils";
import { computeDurations, notifyAdminsForDailyFlowEvent } from "@/lib/daily-flow";

/**
 * POST: Yöneticinin, bir kullanıcı için o gün (veya geçmiş bir gün) hiç
 * kaydı yoksa elle yeni bir Günlük Akış kaydı oluşturması. Var olan bir
 * kaydı bu uç noktadan değiştirmiyoruz — kayıt zaten varsa mevcut
 * `PATCH /api/daily-flow/admin/entries/[entryId]` kullanılır (bkz. görev
 * #168). Oluşturma da bir "düzenleme" gibi DailyFlowEdit'e işlenir; böylece
 * kaydın nasıl var olduğu her zaman denetlenebilir kalır.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const body = await req.json();
    const data = adminCreateDailyFlowEntrySchema.parse(body);

    // Hedef kullanıcının aynı takımda olduğunu doğrula.
    await requireTeamMember(workspace.id, data.userId);

    const date = toDateOrUndefined(data.date)!;
    const startedAt = new Date(data.startedAt);
    const completedAt = data.completedAt ? new Date(data.completedAt) : null;

    const existing = await prisma.dailyFlowEntry.findUnique({
      where: { userId_date: { userId: data.userId, date } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Bu kullanıcı için bu tarihte zaten bir kayıt var — mevcut kaydı düzenleyin." },
        { status: 409 },
      );
    }

    const target = await prisma.user.findUnique({ where: { id: data.userId }, select: { id: true, name: true, email: true } });
    if (!target) throw new NotFoundError("Kullanıcı bulunamadı.");

    const status = completedAt ? "COMPLETED" : "ACTIVE";
    const durations = completedAt
      ? computeDurations(
          {
            id: "",
            userId: data.userId,
            date,
            status: "ACTIVE",
            startedAt,
            completedAt,
            note: data.note ?? null,
            totalActiveSeconds: null,
            totalBreakSeconds: null,
            breakCount: null,
            reopenedById: null,
            reopenedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            breaks: [],
          },
          completedAt,
        )
      : null;

    const editorName = session.user.name || session.user.email || "Yönetici";

    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.dailyFlowEntry.create({
        data: {
          userId: data.userId,
          date,
          status,
          startedAt,
          completedAt,
          note: data.note ?? null,
          totalActiveSeconds: durations?.activeSeconds,
          totalBreakSeconds: durations?.breakSeconds,
          breakCount: durations?.closedBreakCount,
        },
      });
      await tx.dailyFlowEdit.create({
        data: {
          entryId: created.id,
          editedById: session.user.id,
          field: "created",
          oldValue: null,
          newValue: `${formatTime(startedAt)} başlangıçlı kayıt ${editorName} tarafından oluşturuldu.`,
          reason: data.reason,
        },
      });
      return created;
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DAILY_FLOW_EDITED",
      module: "DAILY_FLOW",
      message: `${target.name || target.email} kullanıcısı için ${data.date} tarihine Günlük Akış kaydı oluşturdu.`,
      ipAddress: getClientIp(req),
    });

    await notifyAdminsForDailyFlowEvent({
      teamId: workspace.id,
      excludeUserId: session.user.id,
      eventKey: "onRecordEdited",
      title: "Günlük Akış kaydı oluşturuldu",
      message: `${target.name || target.email} için ${editorName} tarafından ${data.date} tarihine ${dailyFlowFieldLabel("startedAt")} ${formatTime(startedAt)} olan bir kayıt oluşturuldu.`,
      link: "/daily-flow/admin",
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
