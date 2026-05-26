import { Card, CardContent } from "@/components/ui/card";
import { CalendarClock } from "lucide-react";
import { glassPanelClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

type ComingSoonPanelProps = {
  title?: string;
  description?: string;
};

/**
 * Placeholder for features that are temporarily removed while the product team
 * redesigns the experience.
 */
export function ComingSoonPanel({
  title = "Coming soon",
  description = "We're rethinking this area and will ship a cleaner experience. Other parts of the app are unchanged.",
}: ComingSoonPanelProps) {
  return (
    <Card className={cn(glassPanelClass, "relative overflow-hidden")}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
        aria-hidden="true"
      />
      <CardContent className="relative z-10 flex flex-col items-center justify-center gap-3 py-16 text-center sm:py-20">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-xl border border-teal-400/30 bg-linear-to-br from-teal-500/20 to-cyan-500/15 text-teal-200 shadow-inner shadow-white/5"
          aria-hidden
        >
          <CalendarClock className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="max-w-md text-sm leading-relaxed text-white/60">{description}</p>
      </CardContent>
    </Card>
  );
}
