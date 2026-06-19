import { CheckCircle2, CircleDashed, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LearnPackageItemStatus } from "@/lib/lessons/learn-package-readiness";

type Props = {
  status: LearnPackageItemStatus;
  message: string;
  className?: string;
};

export function LearnStudentReadyHint({ status, message, className }: Props) {
  const Icon =
    status === "ready"
      ? CheckCircle2
      : status === "locked"
        ? Lock
        : status === "optional"
          ? CircleDashed
          : Sparkles;

  const tone =
    status === "ready"
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
      : status === "needs_action"
        ? "border-amber-400/20 bg-amber-500/10 text-amber-100"
        : status === "locked"
          ? "border-white/10 bg-white/5 text-white/45"
          : "border-sky-400/15 bg-sky-500/8 text-sky-100/85";

  return (
    <div className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-xs", tone, className)}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
