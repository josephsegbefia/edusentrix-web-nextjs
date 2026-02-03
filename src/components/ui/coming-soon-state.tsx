"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type ComingSoonStateProps = {
  feature: string;
  description?: string;
  className?: string;
};

export function ComingSoonState({
  feature,
  description = "This section is under active development.",
  className,
}: ComingSoonStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card/50 p-6 text-center",
        className
      )}
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" />
        Coming Soon
      </div>
      <p className="mt-3 text-sm font-medium">{feature} is coming soon.</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
