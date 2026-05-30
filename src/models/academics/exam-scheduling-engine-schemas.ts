import {
  EXAM_INVIGILATOR_ROLES,
  EXAM_INVIGILATOR_STATUSES,
  EXAM_SESSION_STATUSES,
  EXAM_TIMETABLE_ENTRY_STATUSES,
  EXAM_TIME_PATTERN,
  EXAM_TYPES,
  EXAM_VENUE_TYPES,
} from "@/constants/academics/exam-scheduling-engine";

export const examSessionStatusEnum = [...EXAM_SESSION_STATUSES];
export const examTypeEnum = [...EXAM_TYPES];
export const examTimetableEntryStatusEnum = [...EXAM_TIMETABLE_ENTRY_STATUSES];
export const examInvigilatorRoleEnum = [...EXAM_INVIGILATOR_ROLES];
export const examInvigilatorStatusEnum = [...EXAM_INVIGILATOR_STATUSES];
export const examVenueTypeEnum = [...EXAM_VENUE_TYPES];

export const examTimeFieldSchema = {
  type: String,
  required: true,
  trim: true,
  match: EXAM_TIME_PATTERN,
} as const;
