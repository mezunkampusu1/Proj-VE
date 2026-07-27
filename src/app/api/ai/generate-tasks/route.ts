import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { aiGenerateTasksSchema } from "@/lib/validations";
import { requireProjectAccess } from "@/lib/permissions";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { generateTasksFromPrompt } from "@/lib/ai";

/**
 * Doğal dil isteğinden görev taslakları üretir. Bu uçta görevler henüz
 * veritabanına yazılmaz — kullanıcı önizleyip onayladıktan sonra
 * /api/projects/[projectId]/tasks üzerinden tek tek (veya toplu) oluşturulur.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const body = await req.json();
    const data = aiGenerateTasksSchema.parse(body);

    await requireProjectAccess(data.projectId, session.user.id);

    const tasks = await generateTasksFromPrompt(data.prompt);

    return NextResponse.json({ tasks });
  } catch (error) {
    return handleApiError(error);
  }
}
