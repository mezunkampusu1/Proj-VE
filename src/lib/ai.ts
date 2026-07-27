import OpenAI from "openai";

// ---------------------------------------------------------------------------
// AI servis katmanı
//
// Uygulamanın geri kalanı bu dosyadaki fonksiyonları çağırır; OpenAI'a özel
// detaylar (istemci kurulumu, model adı, prompt biçimi) burada izole edilir.
// Böylece sağlayıcı değişse bile yalnızca bu dosya güncellenir.
// ---------------------------------------------------------------------------

let client: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AIConfigError(
      "OPENAI_API_KEY tanımlı değil. .env dosyanıza ekleyin.",
    );
  }
  if (!client) {
    client = new OpenAI({ apiKey });
  }
  return client;
}

export class AIConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIConfigError";
  }
}

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export interface GeneratedTask {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}

/**
 * Doğal dilde yazılmış bir isteği yapılandırılmış görev listesine dönüştürür.
 * Örn: "Yeni müşteri onboarding sürecini hazırlamamız lazım, önce form
 * tasarlanacak sonra e-posta akışı kurulacak" -> [{title, description, priority}, ...]
 */
export async function generateTasksFromPrompt(
  prompt: string,
): Promise<GeneratedTask[]> {
  const openai = getClient();

  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Sen bir proje yönetimi asistanısın. Kullanıcının doğal dilde " +
          "verdiği açıklamayı, uygulanabilir görevlere bölersin. Yalnızca " +
          'geçerli JSON döndür: {"tasks": [{"title": string, ' +
          '"description": string, "priority": "LOW"|"MEDIUM"|"HIGH"|"URGENT"}]}. ' +
          "En fazla 10 görev üret. Başlıklar kısa ve eylem odaklı olsun " +
          "(örn. \"Onboarding formunu tasarla\"). Açıklamalar 1-2 cümle " +
          "olsun. Görevleri Türkçe yaz.",
      },
      { role: "user", content: prompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as { tasks?: GeneratedTask[] };
    if (!Array.isArray(parsed.tasks)) return [];
    return parsed.tasks
      .filter((t) => typeof t.title === "string" && t.title.trim().length > 0)
      .slice(0, 10)
      .map((t) => ({
        title: t.title.trim(),
        description: (t.description ?? "").trim(),
        priority: (["LOW", "MEDIUM", "HIGH", "URGENT"] as const).includes(
          t.priority,
        )
          ? t.priority
          : "MEDIUM",
      }));
  } catch {
    return [];
  }
}

interface TaskSummaryInput {
  title: string;
  status: string;
  priority: string;
  assigneeName?: string | null;
  dueDate?: Date | null;
}

/**
 * Bir projedeki görevlerin durumuna bakarak kısa bir Türkçe durum özeti
 * üretir (ör. haftalık rapor, stand-up özeti).
 */
export async function summarizeProject(
  projectName: string,
  tasks: TaskSummaryInput[],
): Promise<string> {
  const openai = getClient();

  const taskLines = tasks
    .map((t) => {
      const due = t.dueDate ? ` (son tarih: ${t.dueDate.toISOString().slice(0, 10)})` : "";
      const assignee = t.assigneeName ? ` — ${t.assigneeName}` : " — atanmamış";
      return `- [${t.status}/${t.priority}] ${t.title}${assignee}${due}`;
    })
    .join("\n");

  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content:
          "Sen bir proje yönetimi asistanısın. Verilen görev listesine " +
          "bakarak kısa (en fazla 150 kelime), yönetici özeti niteliğinde " +
          "bir durum raporu yaz. Genel ilerleme, riskler/geciken işler ve " +
          "öne çıkan öncelikleri Türkçe olarak vurgula. Madde işareti " +
          "kullanma, akıcı paragraflar hâlinde yaz.",
      },
      {
        role: "user",
        content: `Proje: ${projectName}\n\nGörevler:\n${taskLines || "(görev yok)"}`,
      },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() ?? "";
}
