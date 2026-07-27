import { PublicShareView } from "@/components/ortak-alan/public-share-view";

interface PageProps {
  params: Promise<{ token: string }>;
}

/**
 * Ekip dışı paylaşım sayfası — kasıtlı olarak (app) grubunun DIŞINDA,
 * oturum gerektirmeyen ayrı bir route grubunda (`(public)`) yaşar (bkz.
 * (print) grubuyla aynı desen). Tüm mantık istemci tarafındaki
 * PublicShareView'da: bağlantı geçerliliği + şifre kapısı + içerik
 * `/api/public/documents/[token]` üzerinden alınır.
 */
export default async function PublicSharePage({ params }: PageProps) {
  const { token } = await params;
  return <PublicShareView token={token} />;
}
