import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import type { Prisma, ActivityAction, ModuleName } from "@prisma/client";

const PAGE_SIZE = 50;

/**
 * GET: Sistem genelindeki aktivite günlüğü — "log rapor canavarı" (bkz.
 * kullanıcı isteği). `ActivityLog` modeli tüm modüllerin (Görevler,
 * Duyurular, Tarihler, Atlas, Dosyalar, Kullanıcı Raporları, Ekip,
 * Üniversiteler, Günlük Akış, Ortak Alan) ortak, filtrelenebilir işlem
 * geçmişidir — IP adresi dahil. Dashboard'daki "Son Aktiviteler" kartı
 * yalnızca son 8 kaydı gösterir ve artık yalnızca yöneticilere görünür
 * (bkz. dashboard/page.tsx); bu uç ve /activity-log sayfası TAM listeyi,
 * yine yalnızca yöneticilere sunar — çalışanlar bu sayfayı hiç göremez
 * (nav'da da gizli, bkz. app-shell.tsx).
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const userId = searchParams.get("userId");
    const action = searchParams.get("action");
    const module = searchParams.get("module");
    const q = searchParams.get("q");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Prisma.ActivityLogWhereInput = { teamId: workspace.id };
    if (userId) where.userId = userId;
    if (action) where.action = action as ActivityAction;
    if (module) where.module = module as ModuleName;
    if (q) where.message = { contains: q, mode: "insensitive" };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(`${from}T00:00:00`);
      if (to) where.createdAt.lte = new Date(`${to}T23:59:59.999`);
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [logs, total, todayLogs] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          user: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true } },
          task: { select: { id: true, title: true } },
        },
      }),
      prisma.activityLog.count({ where }),
      // Özet kartları için: aktif filtrelerden bağımsız, her zaman "bugün"e
      // ait tüm ekip kayıtları (bkz. AdminDashboard'daki SUMMARY_CARDS
      // deseni — aynı görsel dil).
      prisma.activityLog.findMany({
        where: { teamId: workspace.id, createdAt: { gte: todayStart } },
        select: { userId: true, ipAddress: true, module: true },
      }),
    ]);

    const uniqueUsersToday = new Set(todayLogs.map((l) => l.userId)).size;
    const uniqueIpsToday = new Set(todayLogs.filter((l) => l.ipAddress).map((l) => l.ipAddress)).size;
    const byModuleToday = new Map<string, number>();
    for (const l of todayLogs) {
      const key = l.module ?? "GENEL";
      byModuleToday.set(key, (byModuleToday.get(key) ?? 0) + 1);
    }

    return NextResponse.json({
      logs,
      page,
      pageSize: PAGE_SIZE,
      total,
      hasMore: page * PAGE_SIZE < total,
      summary: {
        totalToday: todayLogs.length,
        activeUsersToday: uniqueUsersToday,
        uniqueIpsToday,
        byModuleToday: Array.from(byModuleToday.entries())
          .map(([module, count]) => ({ module, count }))
          .sort((a, b) => b.count - a.count),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
