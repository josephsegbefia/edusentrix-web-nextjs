function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function TrialBanner({
  endsAt,
}: {
  endsAt?: string | null;
}) {
  const label = formatDate(endsAt);
  if (!label) return null;

  return (
    <div className="border-b border-cyan-400/15 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
      Trial period in progress. The current pilot window ends on {label}.
    </div>
  );
}
