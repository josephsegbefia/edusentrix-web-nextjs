import mongoose from "mongoose";
import { dayOfWeekToWeekdayKey } from "@/lib/timetable/dailyScheduleTimetable";
import { buildDayTimeline } from "@/lib/school-day/timeline";
import { loadResolvedScheduleForSchoolDay } from "@/lib/timetable/load-resolved-schedule";
import { timeToMinutes } from "@/lib/timetable/scheduleSettings";
import { hhmmToMinutes, minutesToHhmm } from "@/lib/school-day/time";
import { SchoolDailySchedule } from "@/models/SchoolDailySchedule";
import { ensureConfigV2 } from "@/lib/school-day/migrate-v2";
import { pickRawDailyConfigForGrade } from "@/lib/school-day/resolveDailyScheduleDoc";

export type PublishedScheduleSegmentKind = "break" | "opening" | "assembly" | "dayEnd";

export type PublishedDayScheduleSegmentDTO = {
  dayOfWeek: number;
  kind: PublishedScheduleSegmentKind;
  label: string;
  detail?: string | null;
  startTime: string;
  endTime: string;
};

function assemblyEndTime(start: string, durationMin: number): string {
  return minutesToHhmm(timeToMinutes(start) + Math.max(1, durationMin));
}

function isAssemblyLabel(name: string): boolean {
  return /assembly|chapel|whole-?school|morning (meet|brief|assembly)|house (meeting|time)/i.test(
    name
  );
}

/**
 * Breaks, assembly / pre-bell blocks, and end-of-day—same resolution as the class timetable editor
 * (v2 school-day config when set, else legacy settings).
 */
export async function loadPublishedDayScheduleSegments(
  schoolId: mongoose.Types.ObjectId,
  gradeId: mongoose.Types.ObjectId,
  workingDays: number[]
): Promise<PublishedDayScheduleSegmentDTO[]> {
  const dailyDoc = await SchoolDailySchedule.findOne({ schoolId })
    .select("config scheduleMode scheduleGroups")
    .lean()
    .exec();
  const raw = pickRawDailyConfigForGrade(dailyDoc, String(gradeId));
  if (raw) {
    const config = ensureConfigV2(raw);
    const gid = String(gradeId);
    const out: PublishedDayScheduleSegmentDTO[] = [];
    for (const dayOfWeek of workingDays) {
      const weekday = dayOfWeekToWeekdayKey(dayOfWeek);
      const { segments, rangeEnd } = buildDayTimeline(config, { weekday, previewGradeId: gid });
      for (const seg of segments) {
        if (seg.kind === "teaching") continue;
        if (seg.kind === "break") {
          out.push({
            dayOfWeek,
            kind: "break",
            label: seg.label,
            startTime: seg.start,
            endTime: seg.end,
          });
        } else if (seg.kind === "pre") {
          const a = isAssemblyLabel(seg.label);
          out.push({
            dayOfWeek,
            kind: a ? "assembly" : "opening",
            label: seg.label,
            startTime: seg.start,
            endTime: seg.end,
          });
        }
      }
      const re = hhmmToMinutes(rangeEnd);
      if (re != null && re > 0) {
        out.push({
          dayOfWeek,
          kind: "dayEnd",
          label: "School day ends",
          detail: `Official end of day · last bell by ${rangeEnd.trim()}`,
          startTime: minutesToHhmm(Math.max(0, re - 5)),
          endTime: rangeEnd.trim(),
        });
      }
    }
    return dedupeSegments(out);
  }

  const out: PublishedDayScheduleSegmentDTO[] = [];
  for (const dayOfWeek of workingDays) {
    const r = await loadResolvedScheduleForSchoolDay(schoolId, gradeId, dayOfWeek);
    if (!r?.isConfigured) continue;
    for (const b of r.breaks) {
      out.push({
        dayOfWeek,
        kind: "break",
        label: b.name || "Break",
        startTime: b.startTime,
        endTime: b.endTime,
      });
    }
    if (r.assembly) {
      out.push({
        dayOfWeek,
        kind: "assembly",
        label: "Assembly",
        startTime: r.assembly.startTime,
        endTime: assemblyEndTime(r.assembly.startTime, r.assembly.duration),
      });
    }
    const end = r.endTime?.trim();
    if (end) {
      const re = hhmmToMinutes(end);
      if (re != null) {
        out.push({
          dayOfWeek,
          kind: "dayEnd",
          label: "School day ends",
          detail: `Official end of day · last bell by ${end}`,
          startTime: minutesToHhmm(Math.max(0, re - 5)),
          endTime: end,
        });
      }
    }
  }
  return dedupeSegments(out);
}

function dedupeSegments(segs: PublishedDayScheduleSegmentDTO[]): PublishedDayScheduleSegmentDTO[] {
  const seen = new Set<string>();
  const o: PublishedDayScheduleSegmentDTO[] = [];
  for (const s of segs) {
    const k = `${s.dayOfWeek}|${s.kind}|${s.startTime}|${s.endTime}|${s.label}`;
    if (seen.has(k)) continue;
    seen.add(k);
    o.push(s);
  }
  return o;
}
