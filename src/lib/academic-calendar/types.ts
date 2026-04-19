export const DEFAULT_AUDIENCE_ROLES = [
  "teacher",
  "parent",
  "student",
  "staff",
  "bursar",
] as const;

export type CalendarAudienceRole = (typeof DEFAULT_AUDIENCE_ROLES)[number];

export type CalendarAudienceScope =
  | "school"
  | "grades"
  | "classes"
  | "specific_users";

export type CalendarEventStatus = "draft" | "published" | "cancelled";

export type CalendarEventType =
  | "academic"
  | "exam"
  | "holiday"
  | "sports"
  | "meeting"
  | "activity"
  | "non_teaching_day"
  | "custom";

export type CalendarRecurrenceFrequency =
  | "none"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly";

export type CalendarEditorScope = "calendar" | "event";

export interface CalendarAudience {
  scope: CalendarAudienceScope;
  gradeIds?: string[];
  classGroupIds?: string[];
  userIds?: string[];
  roles?: CalendarAudienceRole[];
}

export interface CalendarRecurrence {
  frequency: CalendarRecurrenceFrequency;
  interval?: number;
  byWeekday?: number[];
  byMonthDay?: number[];
  until?: string;
  count?: number;
}

export interface CalendarReminder {
  minutesBefore: number;
  channel?: "in_app";
}

export interface CalendarEventOccurrence {
  id: string;
  eventId: string;
  calendarId: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  location?: string | null;
  color?: string | null;
  status: CalendarEventStatus;
  eventType: CalendarEventType;
  isNonTeachingDay: boolean;
  coverImageUrl?: string | null;
  isRecurring: boolean;
}
