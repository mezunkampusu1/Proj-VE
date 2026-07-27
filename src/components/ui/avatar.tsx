"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

export function Avatar({
  name,
  email,
  image,
  size = 32,
  className,
}: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/20 font-medium text-primary",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      title={name || email || undefined}
    >
      {image && (
        <AvatarPrimitive.Image
          src={image}
          alt={name || email || "Kullanıcı"}
          className="h-full w-full object-cover"
        />
      )}
      <AvatarPrimitive.Fallback delayMs={image ? 400 : 0}>
        {initials(name, email)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
