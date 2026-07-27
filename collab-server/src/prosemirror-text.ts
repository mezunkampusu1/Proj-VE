/**
 * ProseMirror JSON ağacından düz metin çıkarır. Arama indeksinin
 * (documents_search_idx) beslediği contentText kolonu ile kelime/karakter
 * sayaçları burada üretilir — Prisma client'a ihtiyaç duymadan, bu servis
 * içinde bağımsız olarak.
 */
export function extractPlainText(node: any): string {
  if (!node) return "";
  if (node.type === "text" && typeof node.text === "string") return node.text;
  if (Array.isArray(node.content)) {
    const isBlock = node.type !== "text";
    const parts = node.content.map((child: any) => extractPlainText(child));
    return isBlock ? parts.join(" ").trim() : parts.join("");
  }
  return "";
}

export function countWordsAndChars(text: string): { wordCount: number; charCount: number } {
  const trimmed = text.trim();
  const wordCount = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
  const charCount = text.length;
  return { wordCount, charCount };
}
