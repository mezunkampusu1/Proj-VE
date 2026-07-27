import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, unauthorized } from "@/lib/api-helpers";

interface Params {
  params: Promise<{ notificationId: string }>;
}

export async function PATCH(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { notificationId } = await params;

    const notification = await prisma.notification.update({
      where: { id: notificationId, userId: session.user.id },
      data: { read: true },
    });

    return NextResponse.json({ notification });
  } catch (error) {
    return handleApiError(error);
  }
}
