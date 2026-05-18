import type { LessonContentBlock } from "@/types/lesson-content-blocks";

export type LessonWeekPlanStatus = "draft" | "ready" | "archived";

export type LessonDeliveryStatus =
  | "scheduled"
  | "in_progress"
  | "delivered"
  | "completed"
  | "cancelled";

export type LessonSessionStatus = "draft" | "ready" | "published" | "archived";

export const DELIVERY_STATUS_LABELS: Record<LessonDeliveryStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const DELIVERY_STATUS_COLORS: Record<LessonDeliveryStatus, string> = {
  scheduled: "bg-slate-500/20 text-slate-200",
  in_progress: "bg-sky-500/20 text-sky-200",
  delivered: "bg-violet-500/20 text-violet-200",
  completed: "bg-emerald-500/20 text-emerald-200",
  cancelled: "bg-rose-500/20 text-rose-200",
};

export type TimetableSlotPreview = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  scheduledDate: string;
  classroomLabel: string | null;
};

export type LessonWeekPlanSessionDto = {
  id: string;
  weekPlanId: string;
  sequenceInWeek: number;
  title: string;
  scheduledDate: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: LessonSessionStatus;
  planNotes: string | null;
  contentBlockCount?: number;
  delivery: {
    id: string;
    status: LessonDeliveryStatus;
    scheduledTeacherId?: string;
    ownerTeacherId?: string;
    actualTeacherId: string | null;
    substituteReason?: "leave" | "absence" | "delegation" | "other" | null;
    startedAt?: string | null;
    endedAt?: string | null;
    completedAt?: string | null;
    attendanceBeforeId?: string | null;
    attendanceAfterId?: string | null;
  } | null;
};

export type LessonSessionDetailDto = LessonWeekPlanSessionDto & {
  lessonNoteId: string;
  classGroupId: string;
  subjectOfferingId: string;
  contentBlocks: LessonContentBlock[];
  contentVersion: number;
  unreviewedAiBlockCount: number;
  studentVisibility: "hidden" | "published";
  parentVisibility: boolean;
  adminVisibility: boolean;
  noteSectionAllocation: {
    schemeItemIds: string[];
    noteSectionKeys: string[];
    coverageWeight: number;
  };
};

export type CreateWeekPlanSessionInput = {
  timetableSlotId: string;
  title: string;
  include?: boolean;
  noteSectionKeys?: string[];
  schemeItemIds?: string[];
  coverageWeight?: number;
  contentBlocks?: LessonContentBlock[];
};

export type SessionLinkedAssignmentsSummary = {
  total: number;
  published: number;
  draft: number;
  quizCount: number;
  assignmentCount: number;
};

export type SessionLinkedAssignmentItem = {
  id: string;
  title: string;
  type: "assignment" | "quiz" | "project" | "practice";
  status: "draft" | "published" | "closed" | "archived";
  dueDate: string;
  maxScore: number;
  submissionCount: number;
  createdAt: string | null;
};

export type LessonWeekPlanDto = {
  id: string;
  title: string;
  weekLabel: string;
  weekStartDate: string;
  weekEndDate: string;
  classGroupId: string;
  subjectOfferingId: string;
  lessonNoteId: string;
  lessonNoteTopic: string | null;
  status: LessonWeekPlanStatus;
  sessions: LessonWeekPlanSessionDto[];
  deliverySummary: {
    total: number;
    completed: number;
    delivered: number;
    scheduled: number;
  };
};

export type WeekCreationContextResponse = {
  success: boolean;
  error?: string;
  data: {
    lessonNote: {
      id: string;
      topic: string;
      status: string;
      weekStartDate: string | null;
      weekEndDate: string | null;
    };
    classGroupId: string;
    subjectOfferingId: string;
    weekLabel: string;
    weekStartDate: string;
    weekEndDate: string;
    timetableSlotCount: number;
    timetableSlots: TimetableSlotPreview[];
    hasPublishedTimetable: boolean;
    canCreate: boolean;
    blockReason: string | null;
    allocatableNoteSectionKeys: string[];
    enableLeoLessonTools: boolean;
    requireTeacherReviewForAiContent: boolean;
  };
};

export type LessonWeekPlansListResponse = {
  success: boolean;
  error?: string;
  data: {
    weekGroups: Array<{
      weekStartDate: string;
      weekEndDate: string;
      weekLabel: string;
      plans: LessonWeekPlanDto[];
    }>;
  };
};
