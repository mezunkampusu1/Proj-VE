import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export function ComingSoon({
  icon: Icon,
  title,
  description,
  phase,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center text-center">
      <Card className="w-full">
        <CardContent className="flex flex-col items-center gap-3 pt-8 pb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Icon className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
          <p className="mt-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
            {phase} kapsamında geliştirilecek
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
