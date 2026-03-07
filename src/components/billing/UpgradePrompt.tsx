import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UpgradePrompt({
  title,
  description,
  feature,
}: {
  title?: string;
  description?: string;
  feature?: string;
}) {
  const resolvedTitle = title || "Upgrade Required";
  const resolvedDescription =
    description ||
    `Your current subscription does not include access to ${feature || "this feature"}.`;

  return (
    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-full bg-amber-400/15 p-2">
            <Lock className="h-4 w-4" />
          </span>
          <div>
            <p className="font-medium text-amber-50">{resolvedTitle}</p>
            <p className="text-amber-100/80">{resolvedDescription}</p>
          </div>
        </div>
        <Button asChild size="sm" className="bg-amber-500 text-black hover:bg-amber-400">
          <Link href="/admin/billing">
            Review Plans
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
