import { hhmmToMinutes } from "@/lib/school-day/time";

/** Human label for Leo / UI (gap start time in HH:MM). */
export function timeOfDayContext(startTime: string, dayName: string): string {
  const m = hhmmToMinutes(startTime.trim());
  if (m == null) return `on ${dayName}`;
  const d = m / 60;
  let band: string;
  if (d < 8.5) band = "early in the school day";
  else if (d < 11) band = "mid-morning";
  else if (d < 13) band = "around midday";
  else if (d < 15) band = "afternoon";
  else band = "late in the day";
  return `${dayName}, ${band}`;
}
