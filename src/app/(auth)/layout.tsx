import Image from "next/image";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* Dekoratif gradyan blob'lar — startup/ürün lansman sayfası hissi
          için; pointer-events-none ve overflow-hidden ile içeriği etkilemez. */}
      <div
        aria-hidden
        className="animate-blob pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-[image:var(--gradient-primary)] opacity-20 blur-3xl"
      />
      <div
        aria-hidden
        className="animate-blob pointer-events-none absolute -bottom-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-[image:var(--gradient-primary)] opacity-[0.14] blur-3xl"
        style={{ animationDelay: "-7s" }}
      />

      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="relative mb-8">
        <Image
          src="/logo-full.png"
          alt="V.E Education & Consultancy"
          width={1946}
          height={1249}
          priority
          unoptimized
          className="h-16 w-auto"
        />
      </div>
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card/95 p-6 shadow-[var(--shadow-modal)] backdrop-blur-sm">
        {children}
      </div>
    </div>
  );
}
