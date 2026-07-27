import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTeamSchema } from "@/lib/validations";
import { handleApiError, unauthorized } from "@/lib/api-helpers";

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || "takim"}-${suffix}`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return unauthorized();

  const teams = await prisma.team.findMany({
    where: { members: { some: { userId: session.user.id } } },
    include: {
      _count: { select: { members: true, projects: true } },
      members: {
        where: { userId: session.user.id },
        select: { role: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ teams });
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const body = await req.json();
    const data = createTeamSchema.parse(body);

    const team = await prisma.team.create({
      data: {
        name: data.name,
        slug: slugify(data.name),
        members: {
          create: { userId: session.user.id, role: "ADMIN" },
        },
      },
    });

    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
