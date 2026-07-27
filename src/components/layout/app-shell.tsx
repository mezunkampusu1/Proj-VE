"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  LayoutDashboard,
  Users2,
  Megaphone,
  BarChart3,
  CalendarRange,
  GraduationCap,
  FolderOpen,
  KanbanSquare,
  Bell,
  Settings,
  LogOut,
  ChevronsUpDown,
  ChevronDown,
  Timer,
  Layers,
  Menu,
  X,
  ScrollText,
  Wallet,
  ClipboardList,
  Share2,
  FileSpreadsheet,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { roleLabel, cn } from "@/lib/utils";

interface NavLink {
  type: "link";
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  comingSoon?: boolean;
}

interface NavGroup {
  type: "group";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavLink[];
}

type NavEntry = NavLink | NavGroup;

function link(label: string, href: string, icon: NavLink["icon"]): NavLink {
  return { type: "link", label, href, icon };
}

/**
 * Nav sırası ekibin gerçek günlük kullanım akışına göredir (bkz. kullanıcı
 * talebi): 1) gün başında/sonunda ilk açılan Günlük Akış en üstte olsun,
 * 2) ardından Görevler, 3) "günlük iş modeli" olan Kullanıcı Raporları/
 * Duyurular/Tarihler/Atlas tek bir açılır grupta toplanır (dördü de aynı
 * işin farklı yüzleri olduğu için ayrı ayrı sırada dolaşmak yerine tek bir
 * yerde), 4) Dosyalar (paylaşılan evraklar), 5) Ortak Alan ve 6) Finans en
 * altta — ikisi de daha az sıklıkta, "arka plan" işleri.
 */
function buildNav(workspaceId: string, role: "ADMIN" | "MEMBER"): { section: string; items: NavEntry[] }[] {
  return [
    {
      section: "Menü",
      items: [
        link("Panel", "/dashboard", LayoutDashboard),
        link("Günlük Akış", "/daily-flow", Timer),
        link("Projelendirme", `/teams/${workspaceId}`, KanbanSquare),
        {
          type: "group",
          label: "Sosyal Medya & İçerik",
          icon: Share2,
          items: [
            link("İçerik Takvimi", "/content/calendar", CalendarRange),
            link("Sosyal Medya", "/content/social", Share2),
            link("Blog & SEO", "/content/blog", Megaphone),
            link("SEO Çalışmaları", "/content/seo", GraduationCap),
            link("Raporlama & Performans", "/content/reports", BarChart3),
          ],
        },
        {
          type: "group",
          label: "Günlük İş Takibi",
          icon: ClipboardList,
          items: [
            link("Veri Girişi", "/veri-girisi", FileSpreadsheet),
            link("Kullanıcı Raporları", "/reports", Users2),
            link("Atlas", "/atlas", GraduationCap),
          ],
        },
        link("Dosyalar", "/files", FolderOpen),
        link("Ortak Alan", "/ortak-alan", Layers),
        link("Finans", "/finance", Wallet),
      ],
    },
    {
      section: "Diğer",
      items: [
        link("Bildirimler", "/notifications", Bell),
        link("Ekip", `/teams/${workspaceId}/members`, Users2),
        // Revizyon: "Son Aktiviteler kısmı sadece adminde görülsün ama log
        // sayfasında çalışanlar bunu görmesin" — bu nav ögesi yalnızca
        // yöneticilere gösterilir (sayfa da ayrıca kendi içinde kilitli,
        // bkz. activity-log/page.tsx).
        ...(role === "ADMIN" ? [link("Aktivite Günlüğü", "/activity-log", ScrollText)] : []),
        link("Ayarlar", "/settings", Settings),
      ],
    },
  ];
}

function isLinkActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}

function NavLinkRow({ item, active }: { item: NavLink; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
        active
          ? "bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow-primary)]"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 transition-transform ${active ? "" : "group-hover:scale-110"}`} />
      <span className="truncate">{item.label}</span>
      {item.comingSoon && (
        <Badge tone="slate" className="ml-auto shrink-0">
          Yakında
        </Badge>
      )}
    </Link>
  );
}

/**
 * "Günlük İş Takibi" gibi birden fazla ilgili sayfayı tek başlık altında
 * toplayan açılır grup. İçindeki sayfalardan biri aktifse grup otomatik
 * açık başlar (kullanıcı o akışın içindeyken menü kendiliğinden kapanmasın
 * diye); aksi halde kapalı başlar ki ana menü uzun ve dağınık görünmesin.
 */
function NavGroupRow({ group, pathname }: { group: NavGroup; pathname: string }) {
  const hasActiveChild = group.items.some((item) => isLinkActive(pathname, item.href));
  const [open, setOpen] = useState(hasActiveChild);

  useEffect(() => {
    if (hasActiveChild) setOpen(true);
  }, [hasActiveChild]);

  const Icon = group.icon;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
          hasActiveChild && !open
            ? "text-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
        <span className="truncate">{group.label}</span>
        <ChevronDown className={`ml-auto h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5 border-l border-border/70 pl-3.5">
          {group.items.map((item) => (
            <NavLinkRow key={item.href} item={item} active={isLinkActive(pathname, item.href)} />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarContent({
  nav,
  pathname,
  user,
  role,
}: {
  nav: { section: string; items: NavEntry[] }[];
  pathname: string;
  user: { name?: string | null; email?: string | null };
  role: "ADMIN" | "MEMBER";
}) {
  return (
    <>
      <div className="relative flex h-16 shrink-0 items-center border-b border-border px-4">
        <div className="pointer-events-none absolute left-2 top-1/2 h-12 w-24 -translate-y-1/2 rounded-full bg-[image:var(--gradient-primary)] opacity-[0.14] blur-2xl" />
        <Image
          src="/logo-mark.png"
          alt="V.E Education & Consultancy"
          width={1642}
          height={871}
          priority
          unoptimized
          className="relative h-9 w-auto"
        />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {nav.map((group) => (
          <div key={group.section}>
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.section}
            </p>
            <div className="mt-1.5 space-y-0.5">
              {group.items.map((item) =>
                item.type === "group" ? (
                  <NavGroupRow key={item.label} group={item} pathname={pathname} />
                ) : (
                  <NavLinkRow key={item.href} item={item} active={isLinkActive(pathname, item.href)} />
                ),
              )}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-xl p-1.5 text-left outline-none transition-colors hover:bg-accent">
            <Avatar name={user.name} email={user.email} size={32} className="ring-2 ring-background" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {user.name || user.email}
              </p>
              <p className="truncate text-xs text-muted-foreground">{roleLabel(role)}</p>
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Ayarlar
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-2 text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Çıkış yap
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}

export function AppShell({
  children,
  user,
  workspaceId,
  role,
}: {
  children: React.ReactNode;
  user: { name?: string | null; email?: string | null };
  workspaceId: string;
  workspaceName: string;
  role: "ADMIN" | "MEMBER";
}) {
  const pathname = usePathname();
  const nav = buildNav(workspaceId, role);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Sayfa değiştiğinde mobil menüyü otomatik kapat — aksi halde kullanıcı
  // bir bağlantıya tıkladıktan sonra menü açık kalıp yeni sayfanın üzerinde
  // duruyor.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Masaüstü: sabit, her zaman görünür kenar çubuğu (bkz. §mobil uyum
          revizyonu — önceden bu kenar çubuğu mobilde de sabit 16rem
          genişlikte render ediliyordu ve küçük ekranlarda içeriği
          neredeyse tamamen kaplayıp yatay taşmaya yol açıyordu). */}
      <aside className="relative hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="absolute inset-x-0 top-0 h-1 bg-[image:var(--gradient-primary)]" />
        <SidebarContent nav={nav} pathname={pathname} user={user} role={role} />
      </aside>

      {/* Mobil: hamburger menüyle açılan kayar çekmece. */}
      <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DialogPortal>
          <DialogOverlay className="md:hidden" />
          <DialogPrimitive.Content
            className={cn(
              "fixed inset-y-0 left-0 z-50 flex h-full w-72 max-w-[80vw] flex-col border-r border-border bg-card shadow-[var(--shadow-modal)] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left md:hidden",
            )}
          >
            <DialogPrimitive.Title className="sr-only">Menü</DialogPrimitive.Title>
            <div className="absolute inset-x-0 top-0 h-1 bg-[image:var(--gradient-primary)]" />
            <DialogPrimitive.Close className="absolute right-3 top-[18px] z-10 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Kapat</span>
            </DialogPrimitive.Close>
            <SidebarContent nav={nav} pathname={pathname} user={user} role={role} />
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-card/95 px-4 backdrop-blur-sm sm:px-6">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Menüyü aç"
            className="-ml-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex flex-1 items-center justify-end gap-2">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
