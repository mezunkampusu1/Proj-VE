import { cn } from "@/lib/utils";
import { tagBadgeStyle } from "@/lib/tag-colors";

/** Renkli etiket rozeti — bkz. görev #195. `tag.color` yoksa palet varsayılanına düşer. */
export function TagBadge({
  name,
  color,
  className,
  children,
}: {
  name: string;
  color: string | null | undefined;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <span
      style={tagBadgeStyle(color)}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {name}
      {children}
    </span>
  );
}
