import Link from "next/link";

const linkClass =
  "text-sky-300 underline underline-offset-2 transition hover:text-sky-200";

type Props = {
  /** Show labels inline vs stacked (narrow screens). */
  layout?: "inline" | "stack";
};

/**
 * Phase 5 — Shared cross-links between student work (assignments) and outcomes (results),
 * plus calendar/notices. Copy-only; no API.
 */
export function StudentParityNavLinks({ layout = "inline" }: Props) {
  const links = (
    <>
      <Link href="/student/assignments" className={linkClass}>
        Assignments
      </Link>
      <span className="text-white/35">·</span>
      <Link href="/student/results" className={linkClass}>
        Results
      </Link>
      <span className="text-white/35">·</span>
      <Link href="/student/calendar" className={linkClass}>
        Calendar
      </Link>
      <span className="text-white/35">·</span>
      <Link href="/student/notices" className={linkClass}>
        Notices
      </Link>
    </>
  );

  if (layout === "stack") {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <Link href="/student/assignments" className={linkClass}>
          Assignments — class work and deadlines
        </Link>
        <Link href="/student/results" className={linkClass}>
          Results — published grades
        </Link>
        <Link href="/student/calendar" className={linkClass}>
          Calendar — events and key dates
        </Link>
        <Link href="/student/notices" className={linkClass}>
          Notices — school announcements
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
      {links}
    </div>
  );
}
