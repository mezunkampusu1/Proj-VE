/**
 * İstemci tarafında Ortak Alan collab jetonu isteme yardımcı fonksiyonu.
 * Jeton 5 dakika geçerlidir; HocuspocusProvider bağlantı koptuğunda
 * otomatik yeniden bağlanmayı dener — `token` callback'i her denemede bu
 * fonksiyonu tekrar çağırarak taze bir jeton alır (bkz.
 * collaborative-editor.tsx).
 */
export interface CollabTokenResponse {
  token: string;
  wsUrl: string;
  documentId: string;
  level: "VIEWER" | "COMMENTER" | "EDITOR" | "OWNER";
  user: { id: string; name: string; email: string | null };
}

export async function fetchCollabToken(documentId: string): Promise<CollabTokenResponse> {
  const res = await fetch(`/api/documents/${documentId}/collab-token`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Ortak Alan bağlantı jetonu alınamadı.");
  }
  return res.json();
}

/** Kullanıcı kimliğinden tutarlı bir imleç rengi türetir (basit hash). */
export function colorForUserId(userId: string): string {
  const palette = [
    "#f97316", "#ec4899", "#8b5cf6", "#06b6d4", "#22c55e",
    "#eab308", "#ef4444", "#3b82f6", "#14b8a6", "#a855f7",
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}
