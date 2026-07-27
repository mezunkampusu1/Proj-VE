/**
 * Etiket renk paleti (bkz. görev #195 — "etiketler çok önemli, renkli
 * olsunlar"). `Tag.color` şemada zaten vardı ama hiçbir UI onu okumuyor/
 * yazmıyordu; bu dosya hem seçim paletini hem de bir hex rengi tema-uyumlu
 * (açık/koyu) bir rozet stiline çeviren yardımcıyı tanımlar. Her rengin
 * arkaplanı düşük opaklıkla (~16%), yazı/kenarlık rengi ise tam opaklıkla
 * kullanılır — böylece hem açık hem koyu temada okunabilir kalır.
 */
export const TAG_COLOR_PALETTE = [
  "#64748b", // slate
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ef4444", // red
  "#f59e0b", // amber
  "#10b981", // emerald
  "#06b6d4", // cyan
] as const;

export function tagBadgeStyle(color: string | null | undefined): React.CSSProperties {
  const hex = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : TAG_COLOR_PALETTE[0];
  return {
    backgroundColor: `${hex}26`,
    color: hex,
    borderColor: `${hex}40`,
  };
}
