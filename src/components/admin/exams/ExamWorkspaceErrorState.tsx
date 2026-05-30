"use client";

import Link from "next/link";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import {
  glassInsetClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

type ExamWorkspaceErrorStateProps = {
  title?: string;
  description: string;
  onRetry?: () => void;
  retrying?: boolean;
  backHref?: string;
  backLabel?: string;
  className?: string;
};

export function ExamWorkspaceErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  retrying = false,
  backHref,
  backLabel = "Back",
  className,
}: ExamWorkspaceErrorStateProps) {
  return (
    <GlassPanel className={cn("p-6 sm:p-8", className)}>
      <div className={cn(glassInsetClass, "mx-auto max-w-lg px-6 py-10 text-center")}>
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-300/90" />
        <h2 className="mt-4 text-lg font-semibold text-white">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/60">{description}</p>
        <div className="mt-6 flex flex-col-reverse justify-center gap-2 sm:flex-row">
          {backHref ? (
            <Button type="button" variant="outline" className={glassSecondaryButtonClass} asChild>
              <Link href={backHref}>{backLabel}</Link>
            </Button>
          ) : null}
          {onRetry ? (
            <Button
              type="button"
              className={glassPrimaryButtonClass}
              onClick={onRetry}
              disabled={retrying}
            >
              {retrying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Retrying…
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try again
                </>
              )}
            </Button>
          ) : null}
        </div>
      </div>
    </GlassPanel>
  );
}
