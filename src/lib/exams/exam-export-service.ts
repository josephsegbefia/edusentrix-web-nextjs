import mongoose, { Types } from "mongoose";
import { ExamInvigilatorAssignment } from "@/models/ExamInvigilatorAssignment";
import { ExamSession } from "@/models/ExamSession";
import { ExamTimetableEntry } from "@/models/ExamTimetableEntry";
import { ExamVenue } from "@/models/ExamVenue";
import { ClassGroup } from "@/models/ClassGroup";
import { Subject } from "@/models/Subject";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import type {
  ExamExportMode,
  ExamExportPdfType,
  ExamTimetableExportRowDTO,
} from "@/types/academics/exam-scheduling-engine";
import { EXAM_EXPORT_MODES } from "@/constants/academics/exam-scheduling-engine";

export class ExamExportServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ExamExportServiceError";
    this.status = status;
  }
}

const PUBLISHED_ENTRY_STATUSES = ["published", "in_progress", "completed", "rescheduled"];
const DRAFT_ENTRY_STATUSES = ["draft", "ready", "published", "in_progress", "completed", "rescheduled"];

function escapeCsv(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function parseExamExportMode(value: string | null): ExamExportMode {
  if (value && EXAM_EXPORT_MODES.includes(value as ExamExportMode)) {
    return value as ExamExportMode;
  }
  return "published";
}

async function loadExportContext(input: {
  schoolId: Types.ObjectId;
  sessionId: string;
  mode: ExamExportMode;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.sessionId)) {
    throw new ExamExportServiceError("Invalid exam session id.", 400);
  }

  const session = await ExamSession.findOne({
    _id: input.sessionId,
    schoolId: input.schoolId,
  }).lean();

  if (!session) {
    throw new ExamExportServiceError("Exam session not found.", 404);
  }

  const statusFilter =
    input.mode === "published" ? PUBLISHED_ENTRY_STATUSES : DRAFT_ENTRY_STATUSES;

  const [entries, invigilators] = await Promise.all([
    ExamTimetableEntry.find({
      schoolId: input.schoolId,
      examSessionId: session._id,
      status: { $in: statusFilter },
    })
      .sort({ date: 1, startTime: 1 })
      .lean(),
    ExamInvigilatorAssignment.find({
      schoolId: input.schoolId,
      examSessionId: session._id,
      status: { $in: ["assigned", "acknowledged", "completed"] },
    }).lean(),
  ]);

  const subjectIds = entries.map((entry) => entry.subjectId);
  const classGroupIds = entries.flatMap((entry) => entry.classGroupIds);
  const venueIds = entries.map((entry) => entry.venueId).filter(Boolean) as Types.ObjectId[];
  const teacherIds = invigilators.map((row) => row.teacherId);

  const [subjects, classGroups, venues, teachers] = await Promise.all([
    subjectIds.length
      ? Subject.find({ _id: { $in: subjectIds }, schoolId: input.schoolId }).select("name").lean()
      : Promise.resolve([]),
    classGroupIds.length
      ? ClassGroup.find({ _id: { $in: classGroupIds }, schoolId: input.schoolId }).select("name").lean()
      : Promise.resolve([]),
    venueIds.length
      ? ExamVenue.find({ _id: { $in: venueIds }, schoolId: input.schoolId }).select("name").lean()
      : Promise.resolve([]),
    teacherIds.length
      ? Teacher.find({ _id: { $in: teacherIds }, schoolId: input.schoolId }).select("userId").lean()
      : Promise.resolve([]),
  ]);

  const userIds = teachers.map((row) => row.userId).filter(Boolean) as Types.ObjectId[];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select("firstName lastName name email").lean()
    : [];

  const subjectMap = new Map(subjects.map((row) => [String(row._id), row.name]));
  const classGroupMap = new Map(classGroups.map((row) => [String(row._id), row.name]));
  const venueMap = new Map(venues.map((row) => [String(row._id), row.name]));
  const teacherUserMap = new Map(teachers.map((row) => [String(row._id), row.userId ? String(row.userId) : ""]));
  const userNameMap = new Map(
    users.map((row) => [
      String(row._id),
      [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || row.name || row.email || "Teacher",
    ])
  );

  const invigilatorsByEntry = new Map<string, string[]>();
  for (const assignment of invigilators) {
    const key = String(assignment.examTimetableEntryId);
    const teacherName =
      userNameMap.get(teacherUserMap.get(String(assignment.teacherId)) ?? "") ?? "Teacher";
    const label = `${teacherName} (${assignment.role})`;
    invigilatorsByEntry.set(key, [...(invigilatorsByEntry.get(key) ?? []), label]);
  }

  const rows: ExamTimetableExportRowDTO[] = entries
    .filter((entry) => input.mode === "draft" || !entry.isUnscheduled)
    .map((entry) => ({
      date: entry.date.toISOString().slice(0, 10),
      startTime: entry.startTime,
      endTime: entry.endTime,
      classGroups: entry.classGroupIds
        .map((id) => classGroupMap.get(String(id)))
        .filter(Boolean)
        .join(", "),
      subject: entry.title || subjectMap.get(String(entry.subjectId)) || "Subject",
      venue: entry.venueId
        ? venueMap.get(String(entry.venueId)) ?? entry.roomLabel ?? ""
        : entry.roomLabel ?? "",
      invigilators: (invigilatorsByEntry.get(String(entry._id)) ?? []).join("; "),
      status: entry.status,
      instructions: entry.instructionsForStudents ?? "",
    }));

  return { session, rows };
}

export async function buildExamTimetableCsvExport(input: {
  schoolId: Types.ObjectId;
  sessionId: string;
  mode: ExamExportMode;
  classGroupId?: string | null;
  teacherId?: string | null;
  venueId?: string | null;
}) {
  const { session, rows } = await loadExportContext(input);
  let filtered = rows;

  if (input.classGroupId) {
    filtered = filtered.filter((row) => row.classGroups.includes(input.classGroupId!));
  }
  if (input.venueId) {
    filtered = filtered.filter((row) => row.venue.includes(input.venueId!));
  }

  const header = [
    "Date",
    "Start Time",
    "End Time",
    "Class/Grade",
    "Subject",
    "Venue",
    "Invigilator(s)",
    "Status",
    "Instructions",
  ];

  const lines = [
    header.join(","),
    ...filtered.map((row) =>
      [
        row.date,
        row.startTime,
        row.endTime,
        row.classGroups,
        row.subject,
        row.venue,
        row.invigilators,
        row.status,
        row.instructions,
      ]
        .map((value) => escapeCsv(String(value ?? "")))
        .join(",")
    ),
  ];

  const suffix = input.mode === "published" ? "published" : "draft";
  return {
    fileName: `${session.code || session.name}-exam-timetable-${suffix}.csv`.replace(/\s+/g, "-"),
    content: lines.join("\n"),
    sessionName: session.name,
    rowCount: filtered.length,
    rows: filtered,
  };
}

export async function buildExamTimetablePdfExport(input: {
  schoolId: Types.ObjectId;
  sessionId: string;
  mode: ExamExportMode;
  type: ExamExportPdfType;
  classGroupId?: string | null;
  teacherId?: string | null;
  venueId?: string | null;
}) {
  const { buildExamTimetablePdfDocument } = await import("@/lib/exams/exam-timetable-export-pdf");
  const csvBundle = await buildExamTimetableCsvExport(input);
  const pdf = await buildExamTimetablePdfDocument({
    sessionName: csvBundle.sessionName,
    exportMode: input.mode,
    exportType: input.type,
    rows: csvBundle.rows,
  });

  return {
    fileName: pdf.fileName,
    bytes: pdf.bytes,
    rowCount: csvBundle.rowCount,
  };
}
