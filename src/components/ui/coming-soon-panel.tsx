import { Card, CardContent } from "@/components/ui/card";
import { CalendarClock } from "lucide-react";

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
  description = "We’re rethinking this area and will ship a cleaner experience. Other parts of the app are unchanged.",
}: ComingSoonPanelProps) {
  return (
    <Card className="border-white/10 bg-white/5">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center sm:py-20">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-violet-500/10 text-violet-200">
          <CalendarClock className="h-7 w-7" aria-hidden />
        </div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="max-w-md text-sm text-white/60">{description}</p>
      </CardContent>
    </Card>
  );
}
