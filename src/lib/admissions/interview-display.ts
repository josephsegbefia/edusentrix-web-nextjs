// Shared copy for interview slot (start + optional end) in emails and public UI.

import { format } from "date-fns/format";

/** Human-readable interview window in the school’s local timezone (Date is interpreted in local time). */
export function formatAdmissionInterviewRange(
  start: Date,
  end?: Date | null
): string {
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const dayStr = format(s, "EEEE, MMMM d, yyyy");
  const startT = format(s, "p");
  if (!e || e.getTime() <= s.getTime()) {
    return `${dayStr} at ${startT}`;
  }
  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();
  if (sameDay) {
    return `${dayStr}, ${startT} – ${format(e, "p")}`;
  }
  return `${format(s, "EEEE, MMMM d, yyyy 'at' p")} – ${format(e, "EEEE, MMMM d, yyyy 'at' p")}`;
}
