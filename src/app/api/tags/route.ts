import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTagSchema } from "@/lib/validations";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { slugify } from "@/lib/utils";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ tags });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const body = await req.json();
    const data = createTagSchema.parse(body);
    const slug = slugify(data.name);

    const existing = await prisma.tag.findUnique({ where: { slug } });
    if (existing) return NextResponse.json({ tag: existing }, { status: 200 });

    const tag = await prisma.tag.create({
      data: { name: data.name.trim(), slug, color: data.color ?? undefined },
    });

    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
