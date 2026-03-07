import { cn } from "@/lib/utils";

export default function SubscriptionBadge({
  status,
  tierName,
}: {
  status?: string | null;
  tierName?: string | null;
}) {
  const normalized = String(status || "draft").toLowerCase();
  const tone =
    normalized === "active"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
      : normalized === "trial"
        ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-100"
        : normalized === "suspended"
          ? "border-red-400/20 bg-red-400/10 text-red-100"
          : normalized === "cancelled"
            ? "border-zinc-400/20 bg-zinc-400/10 text-zinc-100"
            : "border-white/10 bg-white/5 text-white/70";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
        tone
      )}
    >
      {tierName || "Unassigned"} • {normalized}
    </span>
  );
}
