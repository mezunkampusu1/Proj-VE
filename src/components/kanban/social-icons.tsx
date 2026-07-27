/**
 * Görev #319/#320: lucide-react (^1.24.0) marka ikonlarını (Youtube,
 * Instagram, Facebook, Linkedin, Twitter/X) telif hakkı nedeniyle artık
 * içermiyor (bkz. paket kaynağı — hepsi undefined döner). Bu yüzden basit,
 * tanınabilir ama sade el yapımı SVG ikonlar kullanılıyor; harici bir ikon
 * paketi eklemeye gerek kalmadı. Her biri `currentColor` kullanır, dış
 * bileşen `className` ile renk/boyut verir (bkz. social-link.ts).
 */
import type { SocialPlatform } from "@/lib/social-link";

type IconProps = { className?: string };

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TikTokIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M14.5 3h2.6c.2 1.6 1.3 2.9 3 3.3v2.6c-1.1 0-2.2-.3-3.1-.9v5.7c0 3.1-2.5 5.6-5.6 5.6s-5.6-2.5-5.6-5.6 2.5-5.6 5.6-5.6c.3 0 .6 0 .9.1v2.7a3 3 0 1 0 2.2 2.9V3Z" />
    </svg>
  );
}

export function LinkedInIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" />
      <text x="7.3" y="16.5" fontSize="9.5" fontWeight="700" fill="var(--background, #fff)">
        in
      </text>
    </svg>
  );
}

export function FacebookIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="12" cy="12" r="9.5" />
      <path
        d="M13.6 21.5v-7.2h2.4l.36-2.8h-2.76V9.6c0-.8.22-1.35 1.37-1.35h1.47V5.75c-.25-.03-1.13-.11-2.15-.11-2.13 0-3.58 1.3-3.58 3.68v2.05H8.32v2.8h2.39v7.2c.4.06.8.1 1.22.1s.82-.04 1.22-.1Z"
        fill="var(--background, #fff)"
      />
    </svg>
  );
}

export function XIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
      <path d="M4.5 4.5l15 15M19.5 4.5l-15 15" />
    </svg>
  );
}

export const SOCIAL_PLATFORM_ICONS: Record<SocialPlatform, (props: IconProps) => React.JSX.Element> = {
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  linkedin: LinkedInIcon,
  facebook: FacebookIcon,
  x: XIcon,
};

/**
 * Kartta/önizlemede kullanılan tonlu arka plan + metin sınıfları. Revizyon:
 * eskiden linkedin+facebook ikisi de mavi, tiktok+x ikisi de gri idi — kartta
 * ufacık rozet hâlinde neredeyse ayırt edilemiyordu ("eklendiyse ben
 * bilmiyorum neler eklendi" — kullanıcı talebi). Artık projedeki 5 ton
 * (blue/red/green/slate/amber) her platforma benzersiz atanır.
 */
export const SOCIAL_PLATFORM_TONE: Record<SocialPlatform, string> = {
  instagram: "bg-tint-red text-tint-red-foreground",
  tiktok: "bg-tint-slate text-tint-slate-foreground",
  linkedin: "bg-tint-blue text-tint-blue-foreground",
  facebook: "bg-tint-green text-tint-green-foreground",
  x: "bg-tint-amber text-tint-amber-foreground",
};

/**
 * Kanban kartındaki ufacık rozetler için kısaltma — 10px'lik bir ikon
 * simgesi (kamera/nota/harf şekli) o boyutta ayırt edilemiyordu, kısa metin
 * kısaltması daha okunur (bkz. görev #320/#324 revizyonu).
 */
export const SOCIAL_PLATFORM_SHORT_LABELS: Record<SocialPlatform, string> = {
  instagram: "IG",
  tiktok: "TT",
  linkedin: "in",
  facebook: "f",
  x: "X",
};
