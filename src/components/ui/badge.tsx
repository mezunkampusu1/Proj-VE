import { cn } from "@/lib/utils";

type Tone = "slate" | "blue" | "amber" | "red" | "green";

// Her tonun açık/koyu temada doğru kontrasta sahip olması için doğrudan
// Tailwind renk skalası yerine tema-duyarlı tint token'ları kullanılır
// (bkz. globals.css --tint-* değişkenleri).
const toneClasses: Record<Tone, string> = {
  slate: "bg-tint-slate text-tint-slate-foreground",
  blue: "bg-tint-blue text-tint-blue-foreground",
  amber: "bg-tint-amber text-tint-amber-foreground",
  red: "bg-tint-red text-tint-red-foreground",
  green: "bg-tint-green text-tint-green-foreground",
};

export function Badge({
  children,
  tone = "slate",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function priorityTone(priority: string): Tone {
  switch (priority) {
    case "URGENT":
      return "red";
    case "HIGH":
      return "amber";
    case "LOW":
      return "slate";
    default:
      return "blue";
  }
}
