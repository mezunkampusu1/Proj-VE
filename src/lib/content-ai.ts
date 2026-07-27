import { prisma } from "@/lib/prisma";
import { AIConfigError } from "@/lib/ai";
import { NotFoundError, PermissionError } from "@/lib/permissions";
import type { AiActionType, AiOutputDecision } from "@prisma/client";

/**
 * Modül 10 — Claude (Anthropic) destekli içerik üretim katmanı (bkz. proje
 * talebi §9). `lib/ai.ts`'teki OpenAI entegrasyonuyla AYNI izolasyon
 * felsefesi: sağlayıcıya özel detaylar (istemci, model adı, istek biçimi)
 * yalnızca bu dosyada yaşar. API anahtarı YALNIZCA sunucu tarafında okunur,
 * hiçbir zaman istemciye gönderilmez.
 *
 * KRİTİK KURAL: Üretilen içerik burada her zaman TASLAK olarak durur ve asla
 * otomatik olarak SocialContent/BlogContent alanına yazılmaz veya
 * yayınlanmaz — ilgili alana kopyalanması, kullanıcının route seviyesinde
 * yaptığı AYRI ve bilinçli bir eylemdir. Her üretim, kullanıcı/prompt/
 * çıktı/model/token/maliyet/karar bilgisiyle `AiGeneration` tablosunda
 * denetlenebilir şekilde loglanır — hem kabul hem ret hem düzenleme.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
// Anthropic fiyatlandırması zaman içinde değişebilir — maliyet tahmini bu
// yüzden ortam değişkeniyle override edilebilir (varsayılanlar yaklaşıktır,
// kesin fatura Anthropic konsolundan takip edilmelidir).
const DEFAULT_INPUT_PRICE_PER_MTOK = 3;
const DEFAULT_OUTPUT_PRICE_PER_MTOK = 15;

/**
 * `actionType`'a göre sabit sistem promptları — kullanıcı yalnızca serbest
 * metin bağlam/istek girer (bkz. validations.ts generateContentAiSchema),
 * ton/format/dil kuralları burada merkezi olarak tanımlanır (bkz. proje
 * "single source of truth" kuralı).
 */
const SYSTEM_PROMPTS: Record<AiActionType, string> = {
  BLOG_TOPIC_SUGGESTION:
    "Sen bir içerik pazarlama uzmanısın. Verilen bağlama göre 5-8 adet blog konusu öner. Her biri kısa bir başlık ve 1 cümlelik açıklama içersin. Türkçe yaz.",
  BLOG_DRAFT: "Sen bir blog yazarısın. Verilen konu/anahtar kelimelere göre SEO uyumlu bir blog taslağı yaz. Türkçe, akıcı ve bilgilendirici olsun.",
  TITLE_ALTERNATIVES: "Verilen içerik için 6 alternatif başlık öner. Her biri farklı bir açı/ton kullansın. Türkçe yaz, yalnızca başlıkları listele.",
  META_TITLE: "Verilen içerik için SEO uyumlu, 50-60 karakter arası bir meta title öner. Türkçe yaz, yalnızca meta title'ı döndür.",
  META_DESCRIPTION: "Verilen içerik için SEO uyumlu, 140-160 karakter arası bir meta description öner. Türkçe yaz, yalnızca metni döndür.",
  KEYWORD_SUGGESTIONS: "Verilen konu için 10-15 anahtar kelime/kelime öbeği öner (arama hacmi yüksek olabilecek). Türkçe yaz, virgülle ayrılmış liste döndür.",
  CONTENT_OUTLINE: "Verilen konu için H2/H3 seviyeli bir içerik taslağı (heading plan) oluştur. Türkçe yaz.",
  HEADING_STRUCTURE: "Verilen metne göre H1/H2/H3 başlık hiyerarşisi öner. Türkçe yaz.",
  SOCIAL_POST_TEXT: "Verilen bağlama göre ilgi çekici bir sosyal medya gönderi metni yaz. Türkçe, doğal ve platform bağımsız bir üslup kullan.",
  PLATFORM_REWRITE: "Verilen metni belirtilen platforma uygun formatta yeniden yaz (uzunluk/ton platforma göre ayarlansın). Türkçe yaz.",
  INSTAGRAM_HASHTAGS: "Verilen içerik için 15-20 adet ilgili Instagram hashtag'i öner. Yalnızca hashtag listesini döndür (# ile başlasın, boşlukla ayrılsın).",
  LINKEDIN_TEXT: "Verilen bağlama göre profesyonel tonda bir LinkedIn gönderi metni yaz. Türkçe yaz.",
  TWITTER_TEXT: "Verilen bağlama göre kısa, çarpıcı bir X (Twitter) gönderi metni yaz (280 karakteri geçmesin). Türkçe yaz.",
  THREAD_GENERATION: "Verilen konuyu 5-8 tweet'lik bir thread'e böl. Her tweet'i numaralandır. Türkçe yaz.",
  TIKTOK_DESCRIPTION: "Verilen video konusu için kısa, dikkat çekici bir TikTok açıklaması yaz. Türkçe yaz.",
  FACEBOOK_TEXT: "Verilen bağlama göre samimi tonda bir Facebook gönderi metni yaz. Türkçe yaz.",
  CTA_SUGGESTION: "Verilen içerik için 5 farklı harekete geçirici mesaj (CTA) öner. Türkçe yaz, yalnızca listele.",
  SHORTEN: "Verilen metni anlamını koruyarak kısalt (yaklaşık yarı uzunluğa indir). Türkçe yaz.",
  LENGTHEN: "Verilen metni anlamını koruyarak detaylandır/uzat. Türkçe yaz.",
  PROOFREAD: "Verilen metni yazım/dilbilgisi hatalarına karşı düzelt ve akıcılığını artır. Yalnızca düzeltilmiş metni döndür. Türkçe yaz.",
  TONE_CHANGE: "Verilen metni istenen tona göre yeniden yaz (bağlamda tonu belirt, belirtilmemişse daha profesyonel bir tona çevir). Türkçe yaz.",
  SEO_ANALYSIS: "Verilen içeriği SEO açısından değerlendir: eksik anahtar kelime, başlık/meta uyumu, iç link fırsatları gibi noktaları maddeler halinde özetle. Türkçe yaz.",
  GEO_SUGGESTIONS: "Verilen içeriği yapay zekâ arama motorları (GEO) için optimize etmek üzere öneriler sun: doğrudan cevap bloğu, SSS, kaynak güvenilirliği gibi noktalara odaklan. Türkçe yaz.",
  DUPLICATE_DETECTION: "Verilen iki veya daha fazla metni karşılaştır ve anlamsal/ifade benzerliklerini özetle. Türkçe yaz.",
  QUALITY_SCORE: "Verilen içeriği 0-100 arası bir kalite puanıyla değerlendir ve gerekçesini 3-5 madde ile açıkla. Türkçe yaz, puanı ilk satırda 'Puan: X/100' biçiminde ver.",
};

interface AnthropicMessageResponse {
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
}

function estimateCostUsd(promptTokens: number | null, completionTokens: number | null): number | null {
  if (promptTokens == null && completionTokens == null) return null;
  const inputPrice = Number(process.env.ANTHROPIC_INPUT_PRICE_PER_MTOK ?? DEFAULT_INPUT_PRICE_PER_MTOK);
  const outputPrice = Number(process.env.ANTHROPIC_OUTPUT_PRICE_PER_MTOK ?? DEFAULT_OUTPUT_PRICE_PER_MTOK);
  const cost = ((promptTokens ?? 0) / 1_000_000) * inputPrice + ((completionTokens ?? 0) / 1_000_000) * outputPrice;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export interface GenerateContentAiParams {
  userId: string;
  actionType: AiActionType;
  /** Kullanıcının serbest metin isteği/bağlamı — sistem promptu actionType'a göre sabittir. */
  input: string;
  socialContentId?: string | null;
  blogContentId?: string | null;
  maxTokens?: number;
  temperature?: number;
}

export interface ContentAiResult {
  generationId: string;
  output: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  estimatedCostUsd: number | null;
}

/**
 * Claude Messages API'sini çağırır ve sonucu `AiGeneration` tablosuna
 * `decision: PENDING` olarak kaydeder. Çağıran route, dönen `output`'u
 * kullanıcıya gösterir — kullanıcı onaylamadan (bkz. `decideContentAiGeneration`)
 * hiçbir alana otomatik yazılmaz.
 */
export async function generateContentAi(params: GenerateContentAiParams): Promise<ContentAiResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AIConfigError("ANTHROPIC_API_KEY tanımlı değil. .env dosyanıza ekleyin.");
  }
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: params.maxTokens ?? 1024,
        temperature: params.temperature ?? 0.4,
        system: SYSTEM_PROMPTS[params.actionType],
        messages: [{ role: "user", content: params.input }],
      }),
    });
  } catch {
    throw new AIConfigError("Claude API'sine bağlanılamadı. Ağ bağlantısını kontrol edin.");
  }

  const data = (await response.json().catch(() => ({}))) as AnthropicMessageResponse;

  if (!response.ok) {
    throw new AIConfigError(
      `Claude API isteği başarısız (${response.status}): ${data.error?.message ?? "bilinmeyen hata"}`,
    );
  }

  const output = (data.content ?? [])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim();

  const promptTokens = data.usage?.input_tokens ?? null;
  const completionTokens = data.usage?.output_tokens ?? null;
  const estimatedCostUsd = estimateCostUsd(promptTokens, completionTokens);

  const generation = await prisma.aiGeneration.create({
    data: {
      userId: params.userId,
      actionType: params.actionType,
      model,
      prompt: params.input,
      output,
      promptTokens: promptTokens ?? undefined,
      completionTokens: completionTokens ?? undefined,
      estimatedCostUsd: estimatedCostUsd ?? undefined,
      socialContentId: params.socialContentId || undefined,
      blogContentId: params.blogContentId || undefined,
    },
  });

  return { generationId: generation.id, output, model, promptTokens, completionTokens, estimatedCostUsd };
}

/**
 * Bir üretimin sonucu hakkında kullanıcı kararını kaydeder (bkz. proje
 * talebi §9 — "karar" alanı zorunlu denetim bilgisi). Yalnızca üretimi
 * başlatan kullanıcı karar verebilir; başkasının üretimine karar vermek
 * `PermissionError` fırlatır (route seviyesinde ADMIN istisnası eklenebilir).
 */
export async function decideContentAiGeneration(
  generationId: string,
  userId: string,
  isAdmin: boolean,
  decision: AiOutputDecision,
  editedOutput?: string | null,
) {
  const generation = await prisma.aiGeneration.findUnique({ where: { id: generationId } });
  if (!generation) {
    throw new NotFoundError("Üretim kaydı bulunamadı.");
  }
  if (generation.userId !== userId && !isAdmin) {
    throw new PermissionError("Bu üretime yalnızca oluşturan kişi veya admin karar verebilir.");
  }

  return prisma.aiGeneration.update({
    where: { id: generationId },
    data: {
      decision,
      editedOutput: decision === "EDITED" ? editedOutput ?? undefined : undefined,
    },
  });
}
