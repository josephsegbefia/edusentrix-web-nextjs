"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  CalendarRange,
  Plus,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Settings,
  ListFilter,
  Users,
  Trash2,
  Pencil,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { ImageUpload } from "@/components/ui/image-upload";
import { Modal } from "@/components/ui/responsive-modal";
import { premiumMenuItem, premiumSelectContent } from "@/components/ui/premium";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import type {
  CalendarAudience,
  CalendarEventStatus,
  CalendarEventType,
  CalendarRecurrence,
} from "@/lib/academic-calendar/types";
import {
  AgendaList,
  MonthGrid,
  type CalendarOccurrence,
} from "@/components/academic-calendar/CalendarViews";

const EVENT_TYPES: { value: CalendarEventType; label: string; description: string }[] = [
  { value: "academic", label: "Academic", description: "General academic activities" },
  { value: "exam", label: "Exam", description: "Exams, tests, assessments" },
  { value: "holiday", label: "Holiday", description: "School holidays and breaks" },
  { value: "sports", label: "Sports", description: "Sports and athletics" },
  { value: "meeting", label: "Meeting", description: "Meetings and conferences" },
  { value: "activity", label: "Activity", description: "Clubs, trips, projects" },
  { value: "non_teaching_day", label: "Non-Teaching Day", description: "School closed" },
  { value: "custom", label: "Custom", description: "Custom event type" },
];

const EVENT_STATUSES: { value: CalendarEventStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "cancelled", label: "Cancelled" },
];

const AUDIENCE_SCOPES = [
  { value: "school", label: "School-wide" },
  { value: "grades", label: "By grade" },
  { value: "classes", label: "By class" },
  { value: "specific_users", label: "Specific people" },
] as const;

const AUDIENCE_ROLES = [
  { value: "teacher", label: "Teachers" },
  { value: "parent", label: "Parents" },
  { value: "student", label: "Students" },
  { value: "staff", label: "Staff" },
  { value: "bursar", label: "Bursars" },
] as const;

const RECURRENCE_OPTIONS = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
] as const;

const REMINDER_PRESETS = [
  { minutes: 15, label: "15 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 180, label: "3 hours" },
  { minutes: 1440, label: "1 day" },
  { minutes: 4320, label: "3 days" },
  { minutes: 10080, label: "7 days" },
];

const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
] as const;

const DEFAULT_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
];

type CalendarSummary = {
  id: string;
  name: string;
  description: string | null;
  academicPeriodId: string | null;
  color: string | null;
  isPublished: boolean;
  editors?: string[];
  canEdit: boolean;
};

type EventRecord = {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  allDay: boolean;
  location: string | null;
  color: string | null;
  coverImageUrl: string | null;
  status: CalendarEventStatus;
  eventType: CalendarEventType;
  isNonTeachingDay: boolean;
  audience: CalendarAudience;
  recurrence: CalendarRecurrence | null;
  editorScope: "calendar" | "event";
  editorIds: string[];
  reminders?: Array<{ minutesBefore: number; channel?: "in_app" }>;
};

type Occurrence = CalendarOccurrence;

type GradeOption = { id: string; name: string };

type ClassOption = { id: string; name: string; fullLabel: string };

type PeriodOption = { id: string; yearLabel: string; term: string; startDate: string; endDate: string };

type GradeApiItem = { id: string; name: string };
type ClassApiItem = { id: string; name: string; fullLabel?: string };
type PeriodApiItem = {
  _id: string;
  yearLabel: string;
  term: string;
  startDate: string;
  endDate: string;
};

type EditorOption = {
  id: string;
  fullName: string;
  email: string | null;
  photoUrl: string | null;
  role: "teacher" | "bursar";
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function toLocalInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseLocalInput(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateOnlyValue(date: Date | null) {
  if (!date) return "";
  return format(date, "yyyy-MM-dd");
}

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function startOfDayValue(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDayValue(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function isSameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function hasWeekendInRange(start: Date, end: Date) {
  const cursor = startOfDayValue(start);
  const last = startOfDayValue(end);

  while (cursor <= last) {
    if (isWeekend(cursor)) return true;
    cursor.setDate(cursor.getDate() + 1);
  }
  return false;
}

function splitRangeByWeekdays(start: Date, end: Date) {
  const segments: Array<{ start: Date; end: Date }> = [];
  const cursor = startOfDayValue(start);
  const last = startOfDayValue(end);

  let segmentStartDay: Date | null = null;
  let segmentEndDay: Date | null = null;

  const flushSegment = () => {
    if (!segmentStartDay || !segmentEndDay) return;

    const segmentStart = isSameDate(segmentStartDay, start)
      ? new Date(start)
      : startOfDayValue(segmentStartDay);

    const segmentEnd = isSameDate(segmentEndDay, end)
      ? new Date(end)
      : endOfDayValue(segmentEndDay);

    if (segmentStart <= segmentEnd) {
      segments.push({ start: segmentStart, end: segmentEnd });
    }

    segmentStartDay = null;
    segmentEndDay = null;
  };

  while (cursor <= last) {
    if (!isWeekend(cursor)) {
      if (!segmentStartDay) segmentStartDay = new Date(cursor);
      segmentEndDay = new Date(cursor);
    } else {
      flushSegment();
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  flushSegment();
  return segments;
}


const defaultAudience: CalendarAudience = {
  scope: "school",
  gradeIds: [],
  classGroupIds: [],
  userIds: [],
  roles: ["teacher", "parent", "student", "staff", "bursar"],
};

const emptyEventForm = (calendarId?: string) => ({
  id: "",
  calendarId: calendarId || "",
  title: "",
  description: "",
  startDate: toLocalInputValue(new Date()),
  endDate: toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)),
  allDay: false,
  location: "",
  color: DEFAULT_COLORS[0],
  coverImageUrl: "",
  status: "draft" as CalendarEventStatus,
  eventType: "academic" as CalendarEventType,
  isNonTeachingDay: false,
  audience: { ...defaultAudience },
  recurrence: { frequency: "none", interval: 1 } as CalendarRecurrence,
  editorScope: "calendar" as "calendar" | "event",
  editorIds: [] as string[],
  reminders: [] as Array<{ minutesBefore: number; channel?: "in_app" }>,
});

const emptyCalendarForm = {
  id: "",
  name: "",
  description: "",
  academicPeriodId: "",
  color: DEFAULT_COLORS[1],
  isPublished: false,
  editors: [] as string[],
};


export default function AcademicCalendarPage() {
  const [calendars, setCalendars] = React.useState<CalendarSummary[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = React.useState<string>("");
  const [events, setEvents] = React.useState<EventRecord[]>([]);
  const [occurrences, setOccurrences] = React.useState<Occurrence[]>([]);
  const [month, setMonth] = React.useState<Date>(() => startOfMonth(new Date()));
  const [view, setView] = React.useState<"month" | "agenda">("month");
  const [loading, setLoading] = React.useState(false);
  const [editorOptions, setEditorOptions] = React.useState<EditorOption[]>([]);
  const [gradeOptions, setGradeOptions] = React.useState<GradeOption[]>([]);
  const [classOptions, setClassOptions] = React.useState<ClassOption[]>([]);
  const [periodOptions, setPeriodOptions] = React.useState<PeriodOption[]>([]);

  const [calendarModalOpen, setCalendarModalOpen] = React.useState(false);
  const [calendarForm, setCalendarForm] = React.useState({ ...emptyCalendarForm });

  const [eventModalOpen, setEventModalOpen] = React.useState(false);
  const [eventForm, setEventForm] = React.useState(() => emptyEventForm());
  const [isEditingEvent, setIsEditingEvent] = React.useState(false);
  const [publishingCalendarId, setPublishingCalendarId] = React.useState<string | null>(null);
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const activeCalendar = calendars.find((c) => c.id === selectedCalendarId) || null;
  const eventTargetCalendar =
    calendars.find((c) => c.id === eventForm.calendarId) || null;

  const rangeStart = React.useMemo(() => startOfMonth(month), [month]);
  const rangeEnd = React.useMemo(() => endOfMonth(month), [month]);
  const rangeStartIso = React.useMemo(() => rangeStart.toISOString(), [rangeStart]);
  const rangeEndIso = React.useMemo(() => rangeEnd.toISOString(), [rangeEnd]);

  const fetchCalendars = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/academic-calendars?all=1", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to fetch calendars");
      setCalendars(json.data as CalendarSummary[]);
      if (json.data.length > 0) {
        setSelectedCalendarId((prev) => prev || json.data[0].id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load calendars");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEvents = React.useCallback(
    async (calendarId: string) => {
      if (!calendarId) return;
      setLoading(true);
      try {
        const params = new URLSearchParams({
          from: rangeStartIso,
          to: rangeEndIso,
        });
        const res = await fetch(`/api/academic-calendars/${calendarId}/events?${params}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || "Failed to fetch events");
        setEvents(json.data.events as EventRecord[]);
        setOccurrences(json.data.occurrences as Occurrence[]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load events");
      } finally {
        setLoading(false);
      }
    },
    [rangeStartIso, rangeEndIso]
  );

  const fetchEditors = React.useCallback(async () => {
    try {
      const res = await fetch("/api/academic-calendars/editors", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to fetch editors");
      setEditorOptions(json.data as EditorOption[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load editors");
    }
  }, []);

  const fetchGradesAndClasses = React.useCallback(async () => {
    try {
      const [gradesRes, classesRes] = await Promise.all([
        fetch("/api/admin/grades?active=1", { cache: "no-store" }),
        fetch("/api/admin/classes?isActive=true", { cache: "no-store" }),
      ]);

      const gradesJson = await gradesRes.json();
      const classesJson = await classesRes.json();

      if (gradesRes.ok && gradesJson.success) {
        setGradeOptions(
          ((gradesJson.data as GradeApiItem[] | undefined) || []).map((g) => ({
            id: g.id,
            name: g.name,
          }))
        );
      }
      if (classesRes.ok && classesJson.success) {
        setClassOptions(
          ((classesJson.data as ClassApiItem[] | undefined) || []).map((c) => ({
            id: c.id,
            name: c.name,
            fullLabel: c.fullLabel || c.name,
          }))
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load grades/classes");
    }
  }, []);

  const fetchPeriods = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/periods", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) return;
      if (json.periods) {
        setPeriodOptions(
          ((json.periods as PeriodApiItem[] | undefined) || []).map((p) => ({
            id: String(p._id),
            yearLabel: p.yearLabel,
            term: p.term,
            startDate: p.startDate,
            endDate: p.endDate,
          }))
        );
      }
    } catch (error) {
      console.error(error);
    }
  }, []);

  React.useEffect(() => {
    fetchCalendars();
    fetchEditors();
    fetchGradesAndClasses();
    fetchPeriods();
  }, [fetchCalendars, fetchEditors, fetchGradesAndClasses, fetchPeriods]);

  React.useEffect(() => {
    if (selectedCalendarId) {
      fetchEvents(selectedCalendarId);
    }
  }, [selectedCalendarId, month, fetchEvents]);

  const openCalendarModal = (calendar?: CalendarSummary) => {
    if (calendar) {
      setCalendarForm({
        id: calendar.id,
        name: calendar.name,
        description: calendar.description || "",
        academicPeriodId: calendar.academicPeriodId || "",
        color: calendar.color || DEFAULT_COLORS[1],
        isPublished: calendar.isPublished,
        editors: calendar.editors || [],
      });
    } else {
      setCalendarForm({ ...emptyCalendarForm });
    }
    setCalendarModalOpen(true);
  };

  const openEventModal = (event?: EventRecord) => {
    if (!selectedCalendarId) {
      toast.error("Select a calendar first");
      return;
    }
    if (event) {
      setEventForm({
        id: event.id,
        calendarId: selectedCalendarId,
        title: event.title,
        description: event.description || "",
        startDate: toLocalInputValue(new Date(event.startDate)),
        endDate: toLocalInputValue(new Date(event.endDate)),
        allDay: event.allDay,
        location: event.location || "",
        color: event.color || DEFAULT_COLORS[0],
        coverImageUrl: event.coverImageUrl || "",
        status: event.status,
        eventType: event.eventType,
        isNonTeachingDay: event.isNonTeachingDay,
        audience: {
          scope: event.audience.scope || "school",
          gradeIds: event.audience.gradeIds || [],
          classGroupIds: event.audience.classGroupIds || [],
          userIds: event.audience.userIds || [],
          roles: event.audience.roles || defaultAudience.roles,
        },
        recurrence: event.recurrence || { frequency: "none", interval: 1 },
        editorScope: event.editorScope || "calendar",
        editorIds: event.editorIds || [],
        reminders: event.reminders || [],
      });
      setIsEditingEvent(true);
    } else {
      setEventForm(emptyEventForm(selectedCalendarId));
      setIsEditingEvent(false);
    }
    setEventModalOpen(true);
  };

  const openEventModalForDate = React.useCallback(
    (date: Date) => {
      if (!selectedCalendarId) {
        toast.error("Select a calendar first");
        return;
      }

      const start = new Date(date);
      start.setHours(9, 0, 0, 0);
      const end = new Date(start);
      end.setHours(10, 0, 0, 0);

      setEventForm({
        ...emptyEventForm(selectedCalendarId),
        startDate: toLocalInputValue(start),
        endDate: toLocalInputValue(end),
      });
      setIsEditingEvent(false);
      setEventModalOpen(true);
    },
    [selectedCalendarId]
  );

  const handleSaveCalendar = async () => {
    if (!calendarForm.name.trim()) {
      toast.error("Calendar name is required");
      return;
    }

    try {
      let createdCalendarId: string | null = null;
      const payload = {
        name: calendarForm.name.trim(),
        description: calendarForm.description.trim() || null,
        academicPeriodId: calendarForm.academicPeriodId || null,
        color: calendarForm.color || null,
        isPublished: calendarForm.isPublished,
        editors: calendarForm.editors,
      };

      if (calendarForm.id) {
        const res = await fetch(`/api/academic-calendars/${calendarForm.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to update calendar");
        toast.success("Calendar updated");
      } else {
        const res = await fetch("/api/academic-calendars", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to create calendar");
        if (json.data?.id) {
          createdCalendarId = String(json.data.id);
        }
        toast.success("Calendar created");
      }

      setCalendarModalOpen(false);
      await fetchCalendars();
      if (createdCalendarId) {
        setSelectedCalendarId(createdCalendarId);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save calendar");
    }
  };

  const handleToggleCalendarPublish = async (
    calendarId: string,
    nextPublished: boolean
  ) => {
    setPublishingCalendarId(calendarId);
    try {
      const res = await fetch(`/api/academic-calendars/${calendarId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: nextPublished }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update publish status");

      setCalendars((prev) =>
        prev.map((calendar) =>
          calendar.id === calendarId
            ? { ...calendar, isPublished: nextPublished }
            : calendar
        )
      );
      toast.success(nextPublished ? "Calendar published" : "Calendar unpublished");
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update publish status"
      );
      return false;
    } finally {
      setPublishingCalendarId(null);
    }
  };

  const handleDeleteCalendar = async (calendarId: string) => {
    const decision = await confirm({
      title: "Delete Calendar?",
      description:
        "This will permanently delete this calendar and all events linked to it.",
      confirmLabel: "Delete Calendar",
      cancelLabel: "Keep Calendar",
      intent: "destructive",
    });
    if (decision !== "confirm") return;

    try {
      const res = await fetch(`/api/academic-calendars/${calendarId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete calendar");
      toast.success("Calendar deleted");
      if (calendarId === selectedCalendarId) {
        setSelectedCalendarId("");
      }
      fetchCalendars();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete calendar");
    }
  };

  const handleSaveEvent = async () => {
    if (!eventForm.title.trim()) {
      toast.error("Event title is required");
      return;
    }

    const start = parseLocalInput(eventForm.startDate);
    const end = parseLocalInput(eventForm.endDate);
    if (!start || !end) {
      toast.error("Start and end dates are required");
      return;
    }
    if (end < start) {
      toast.error("End date must be after start date");
      return;
    }

    let rangesToCreate: Array<{ start: Date; end: Date }> = [{ start, end }];
    const hasRecurrence =
      Boolean(eventForm.recurrence?.frequency) &&
      eventForm.recurrence?.frequency !== "none";

    if (!isEditingEvent && hasWeekendInRange(start, end)) {
      const weekendDecision = await confirm({
        title: "Weekend Dates Detected",
        description:
          "This event range includes Saturday or Sunday. Keep those dates, or remove weekends before saving.",
        confirmLabel: "Keep Weekends",
        cancelLabel: "Remove Weekends",
        intent: "warning",
      });

      if (weekendDecision === "dismiss") {
        return;
      }

      if (weekendDecision === "cancel") {
        if (hasRecurrence) {
          toast.error(
            "Set recurrence to 'Does not repeat' before removing weekend dates."
          );
          return;
        }

        rangesToCreate = splitRangeByWeekdays(start, end);
        if (rangesToCreate.length === 0) {
          toast.error(
            "The selected range only contains weekend days. Keep weekends or choose weekdays."
          );
          return;
        }
      }
    }

    const targetCalendar = calendars.find((calendar) => calendar.id === eventForm.calendarId);
    let eventStatus: CalendarEventStatus = eventForm.status;

    if (
      eventStatus === "published" &&
      targetCalendar &&
      !targetCalendar.isPublished
    ) {
      const publishDecision = await confirm({
        title: "Calendar Is Still Draft",
        description:
          "Publishing this event alone will not make it visible to parents/teachers while the calendar is draft.",
        confirmLabel: "Publish Calendar + Save Event",
        cancelLabel: "Save Event as Draft",
        intent: "warning",
      });

      if (publishDecision === "dismiss") {
        return;
      }

      if (publishDecision === "confirm") {
        const published = await handleToggleCalendarPublish(targetCalendar.id, true);
        if (!published) {
          return;
        }
      } else {
        eventStatus = "draft";
        toast.info("Saved as draft event because calendar is still draft.");
      }
    }

    const payloadBase = {
      title: eventForm.title.trim(),
      description: eventForm.description.trim() || null,
      allDay: eventForm.allDay,
      location: eventForm.location.trim() || null,
      color: eventForm.color || null,
      coverImageUrl: eventForm.coverImageUrl || null,
      status: eventStatus,
      eventType: eventForm.eventType,
      isNonTeachingDay: eventForm.isNonTeachingDay,
      audience: eventForm.audience,
      recurrence: eventForm.recurrence?.frequency === "none" ? null : eventForm.recurrence,
      editorScope: eventForm.editorScope,
      editorIds: eventForm.editorIds,
      reminders: eventForm.reminders,
    };

    try {
      if (isEditingEvent && eventForm.id) {
        const payload = {
          ...payloadBase,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        };
        const res = await fetch(`/api/academic-calendars/${eventForm.calendarId}/events/${eventForm.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to update event");
        toast.success("Event updated");
      } else {
        for (const range of rangesToCreate) {
          const payload = {
            ...payloadBase,
            startDate: range.start.toISOString(),
            endDate: range.end.toISOString(),
          };
          const res = await fetch(`/api/academic-calendars/${eventForm.calendarId}/events`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "Failed to create event");
        }

        toast.success(
          rangesToCreate.length > 1
            ? `Created ${rangesToCreate.length} events (weekends removed)`
            : "Event created"
        );
      }

      setEventModalOpen(false);
      fetchEvents(eventForm.calendarId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save event");
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!selectedCalendarId) return;
    const decision = await confirm({
      title: "Delete Event?",
      description: "This action cannot be undone.",
      confirmLabel: "Delete Event",
      cancelLabel: "Keep Event",
      intent: "destructive",
    });
    if (decision !== "confirm") return;

    try {
      const res = await fetch(`/api/academic-calendars/${selectedCalendarId}/events/${eventId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete event");
      toast.success("Event deleted");
      fetchEvents(selectedCalendarId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete event");
    }
  };

  const handleSelectOccurrence = (occurrence: Occurrence) => {
    const event = events.find((e) => e.id === occurrence.eventId);
    if (event) openEventModal(event);
  };

  const selectedCalendarEvents = events.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarRange className="h-6 w-6 text-brand" />
            <h1 className="text-2xl font-bold">Academic Calendar</h1>
            <Badge className="bg-white/10 text-white/70">Premium</Badge>
          </div>
          <p className="text-sm text-white/50">
            Build, publish, and delegate your school&apos;s academic calendar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="border-white/10" onClick={() => openCalendarModal()}>
            <Sparkles className="mr-2 h-4 w-4" />
            New Calendar
          </Button>
          <Button onClick={() => openEventModal()} className="group">
            <Plus className="mr-2 h-4 w-4 transition-transform group-hover:rotate-90" />
            New Event
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card className="border-white/10 bg-white/5">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
                Calendars
              </CardTitle>
              <Button size="icon" variant="ghost" onClick={() => openCalendarModal()} className="group">
                <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-white/10 bg-black/20 p-2.5 text-xs text-white/45">
                Calendar visibility is separate from event status.
              </div>
              {calendars.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
                  No calendars yet. Create one to get started.
                </div>
              )}
              {calendars.map((calendar) => (
                <button
                  key={calendar.id}
                  onClick={() => setSelectedCalendarId(calendar.id)}
                  className={cn(
                    "w-full rounded-xl border px-3 py-3 text-left transition",
                    calendar.id === selectedCalendarId
                      ? "border-brand bg-brand/10"
                      : "border-white/5 bg-black/20 hover:border-white/20"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">{calendar.name}</div>
                      <div className="text-xs text-white/50">
                        {calendar.description || "No description"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {calendar.isPublished ? (
                        <Eye className="h-4 w-4 text-emerald-300" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-white/40" />
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge className="bg-white/10 text-white/60">
                      {calendar.isPublished ? "Calendar Published" : "Calendar Draft"}
                    </Badge>
                    {calendar.color && (
                      <span className="h-2 w-6 rounded-full" style={{ backgroundColor: calendar.color }} />
                    )}
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
                Filters
              </CardTitle>
              <ListFilter className="h-4 w-4 text-white/40" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-white/5 bg-black/20 p-3 text-sm text-white/60">
                {selectedCalendarEvents} event{selectedCalendarEvents === 1 ? "" : "s"} in view
              </div>
              <div>
                <label className="text-xs text-white/50">Range start</label>
                <CustomDatePicker
                  value={rangeStart}
                  onChange={(date) => date && setMonth(startOfMonth(date))}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
                Settings
              </CardTitle>
              <Settings className="h-4 w-4 text-white/40" />
            </CardHeader>
            <CardContent className="space-y-3">
              {activeCalendar ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/70">Published</span>
                    <Switch
                      checked={activeCalendar.isPublished}
                      disabled={publishingCalendarId === activeCalendar.id}
                      onCheckedChange={(checked) =>
                        handleToggleCalendarPublish(activeCalendar.id, checked)
                      }
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="group w-full justify-between rounded-xl border-white/15 bg-linear-to-r from-white/10 to-white/5 text-white shadow-lg shadow-black/20 hover:from-white/15 hover:to-white/10"
                    onClick={() => openCalendarModal(activeCalendar)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Pencil className="h-4 w-4 text-white/70 transition group-hover:text-white" />
                      Edit Calendar
                    </span>
                    <span className="text-xs text-white/50 transition group-hover:text-white/80">
                      Update
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    className="group w-full justify-between rounded-xl border-rose-500/30 bg-linear-to-r from-rose-500/15 to-red-500/10 text-rose-200 shadow-lg shadow-rose-950/30 hover:from-rose-500/25 hover:to-red-500/20 hover:text-rose-100"
                    onClick={() => handleDeleteCalendar(activeCalendar.id)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Trash2 className="h-4 w-4 transition group-hover:scale-105" />
                      Delete Calendar
                    </span>
                    <span className="text-xs text-rose-200/70 transition group-hover:text-rose-100">
                      Permanent
                    </span>
                  </Button>
                </>
              ) : (
                <div className="text-sm text-white/50">Select a calendar to manage settings.</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-white/10 bg-white/5">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg text-white">{format(month, "MMMM yyyy")}</CardTitle>
                <p className="text-sm text-white/50">
                  {activeCalendar ? activeCalendar.name : "Select a calendar"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/30 p-1">
                  <button
                    onClick={() => setView("month")}
                    className={cn(
                      "px-3 py-1 text-xs font-semibold rounded-full",
                      view === "month" ? "bg-white/10 text-white" : "text-white/50"
                    )}
                  >
                    Month
                  </button>
                  <button
                    onClick={() => setView("agenda")}
                    className={cn(
                      "px-3 py-1 text-xs font-semibold rounded-full",
                      view === "agenda" ? "bg-white/10 text-white" : "text-white/50"
                    )}
                  >
                    Agenda
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    className="border-white/10"
                    onClick={() => setMonth(addMonths(month, -1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="border-white/10"
                    onClick={() => setMonth(addMonths(month, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading && (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-white/50">
                  Loading calendar...
                </div>
              )}

              {!loading && view === "month" && (
                <MonthGrid
                  month={month}
                  occurrences={occurrences}
                  onSelectOccurrence={handleSelectOccurrence}
                  onSelectDate={openEventModalForDate}
                />
              )}

              {!loading && view === "agenda" && (
                <AgendaList occurrences={occurrences} onSelectOccurrence={handleSelectOccurrence} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {confirmationDialog}

      <Modal
        open={calendarModalOpen}
        onOpenChange={setCalendarModalOpen}
        title={calendarForm.id ? "Edit Calendar" : "Create Calendar"}
        description="Configure calendar settings, publishing status, and delegates."
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Name *</Label>
            <Input
              value={calendarForm.name}
              onChange={(e) => setCalendarForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="2025/2026 Academic Calendar"
              className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Description</Label>
            <Textarea
              value={calendarForm.description}
              onChange={(e) => setCalendarForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Term dates, holidays, and key activities"
              rows={3}
              className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Academic Period</Label>
              <Select
                value={calendarForm.academicPeriodId || "none"}
                onValueChange={(value) =>
                  setCalendarForm((prev) => ({
                    ...prev,
                    academicPeriodId: value === "none" ? "" : value,
                  }))
                }
              >
                <SelectTrigger className="border border-white/10 bg-white/5 text-white hover:bg-white/10 focus:ring-1 focus:ring-brand">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent className={premiumSelectContent}>
                  <SelectItem value="none" className={premiumMenuItem}>
                    None
                  </SelectItem>
                  {periodOptions.map((period) => (
                    <SelectItem key={period.id} value={period.id} className={premiumMenuItem}>
                      {period.yearLabel} · {period.term}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Theme Color</Label>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setCalendarForm((prev) => ({ ...prev, color }))}
                    className={cn(
                      "h-8 w-8 rounded-full border border-white/10 transition-all hover:scale-105",
                      calendarForm.color === color
                        ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 border-transparent"
                        : "hover:border-white/30"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold text-white">Calendar Visibility</div>
                <div className="text-xs text-white/50">
                  This controls whether the calendar is visible to parents and teachers.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={calendarForm.isPublished ? "outline" : "default"}
                  className={cn(
                    "border-white/10",
                    !calendarForm.isPublished
                      ? "bg-white text-black hover:bg-white/90"
                      : "bg-white/5 text-white hover:bg-white/10"
                  )}
                  onClick={() =>
                    setCalendarForm((prev) => ({ ...prev, isPublished: false }))
                  }
                >
                  Draft
                </Button>
                <Button
                  type="button"
                  variant={calendarForm.isPublished ? "default" : "outline"}
                  className={cn(
                    "border-white/10",
                    calendarForm.isPublished
                      ? "bg-emerald-500 text-white hover:bg-emerald-600"
                      : "bg-white/5 text-white hover:bg-white/10"
                  )}
                  onClick={() =>
                    setCalendarForm((prev) => ({ ...prev, isPublished: true }))
                  }
                >
                  Published
                </Button>
                <Badge className="ml-auto bg-white/10 text-white/70">
                  {calendarForm.isPublished ? "Visible" : "Hidden"}
                </Badge>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Delegated editors</Label>
            {editorOptions.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/50">
                No editors available yet.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3">
                {editorOptions.map((editor) => {
                  const isSelected = calendarForm.editors.includes(editor.id);

                  return (
                    <label
                      key={editor.id}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-2.5 text-sm transition-all",
                        isSelected
                          ? "border-brand/40 bg-brand/10 text-white"
                          : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10"
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          setCalendarForm((prev) => ({
                            ...prev,
                            editors: checked
                              ? [...prev.editors, editor.id]
                              : prev.editors.filter((id) => id !== editor.id),
                          }));
                        }}
                        className="h-4 w-4 border-white/30 data-[state=checked]:bg-brand data-[state=checked]:border-brand"
                      />
                      <span className="flex-1 truncate">{editor.fullName}</span>
                      <Badge className="bg-white/10 text-white/60">{editor.role}</Badge>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCalendarModalOpen(false)}
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveCalendar}
              className="bg-brand text-black hover:opacity-90"
            >
              Save Calendar
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={eventModalOpen}
        onOpenChange={setEventModalOpen}
        title={isEditingEvent ? "Edit Event" : "Create Event"}
        description="Add events, set audience, recurrence, and reminders."
        className="sm:max-w-3xl"
      >
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Title *</Label>
              <Input
                value={eventForm.title}
                onChange={(e) => setEventForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Mid-term exams"
                className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Event Type</Label>
              <Select
                value={eventForm.eventType}
                onValueChange={(value) =>
                  setEventForm((prev) => ({
                    ...prev,
                    eventType: value as CalendarEventType,
                    isNonTeachingDay: value === "non_teaching_day",
                    allDay: value === "non_teaching_day" ? true : prev.allDay,
                  }))
                }
              >
                <SelectTrigger className="border border-white/10 bg-white/5 text-white hover:bg-white/10 focus:ring-1 focus:ring-brand">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className={premiumSelectContent}>
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value} className={premiumMenuItem}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Description</Label>
            <Textarea
              value={eventForm.description}
              onChange={(e) => setEventForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Start</Label>
              <Input
                type="datetime-local"
                value={eventForm.startDate}
                onChange={(e) => setEventForm((prev) => ({ ...prev, startDate: e.target.value }))}
                className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">End</Label>
              <Input
                type="datetime-local"
                value={eventForm.endDate}
                onChange={(e) => setEventForm((prev) => ({ ...prev, endDate: e.target.value }))}
                className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div
              role="button"
              tabIndex={0}
              onClick={() =>
                setEventForm((prev) => ({ ...prev, allDay: !prev.allDay }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setEventForm((prev) => ({ ...prev, allDay: !prev.allDay }));
                }
              }}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
            >
              <Switch
                id="event-all-day"
                checked={eventForm.allDay}
                onCheckedChange={(checked) => setEventForm((prev) => ({ ...prev, allDay: checked }))}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="select-none">
                <div className="text-sm font-semibold">All day event</div>
                <div className="text-xs text-white/50">Event spans the full day.</div>
              </div>
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() =>
                setEventForm((prev) => ({
                  ...prev,
                  isNonTeachingDay: !prev.isNonTeachingDay,
                  allDay: !prev.isNonTeachingDay ? true : prev.allDay,
                  eventType: !prev.isNonTeachingDay
                    ? "non_teaching_day"
                    : prev.eventType === "non_teaching_day"
                      ? "academic"
                      : prev.eventType,
                }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setEventForm((prev) => ({
                    ...prev,
                    isNonTeachingDay: !prev.isNonTeachingDay,
                    allDay: !prev.isNonTeachingDay ? true : prev.allDay,
                    eventType: !prev.isNonTeachingDay
                      ? "non_teaching_day"
                      : prev.eventType === "non_teaching_day"
                        ? "academic"
                        : prev.eventType,
                  }));
                }
              }}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
            >
              {/*
                Keep event type in sync when toggling non-teaching:
                - on: force non_teaching_day
                - off: revert to academic if currently non_teaching_day
              */}
              <Switch
                id="event-non-teaching"
                checked={eventForm.isNonTeachingDay}
                onCheckedChange={(checked) =>
                  setEventForm((prev) => ({
                    ...prev,
                    isNonTeachingDay: checked,
                    allDay: checked ? true : prev.allDay,
                    eventType: checked
                      ? "non_teaching_day"
                      : prev.eventType === "non_teaching_day"
                        ? "academic"
                        : prev.eventType,
                  }))
                }
                onClick={(e) => e.stopPropagation()}
              />
              <div className="select-none">
                <div className="text-sm font-semibold">Non-teaching day</div>
                <div className="text-xs text-white/50">Marks a no-class day.</div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Location</Label>
              <Input
                value={eventForm.location}
                onChange={(e) => setEventForm((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="Main Hall"
                className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Status</Label>
              <Select
                value={eventForm.status}
                onValueChange={(value) => setEventForm((prev) => ({ ...prev, status: value as CalendarEventStatus }))}
              >
                <SelectTrigger className="border border-white/10 bg-white/5 text-white hover:bg-white/10 focus:ring-1 focus:ring-brand">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className={premiumSelectContent}>
                  {EVENT_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value} className={premiumMenuItem}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {eventForm.status === "published" &&
            eventTargetCalendar &&
            !eventTargetCalendar.isPublished && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
              This event is set to published, but the selected calendar is still draft. It won&apos;t be visible until the calendar is published.
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Cover Image</Label>
            <ImageUpload
              value={eventForm.coverImageUrl}
              onChange={(url) => setEventForm((prev) => ({ ...prev, coverImageUrl: url }))}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Theme Color</Label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setEventForm((prev) => ({ ...prev, color }))}
                  className={cn(
                    "h-8 w-8 rounded-full border border-white/10 transition-all hover:scale-105",
                    eventForm.color === color
                      ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 border-transparent"
                      : "hover:border-white/30"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <Card className="border-white/10 bg-white/5">
            <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
                Audience & Roles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Audience Scope</Label>
                <Select
                  value={eventForm.audience.scope}
                  onValueChange={(value) =>
                    setEventForm((prev) => ({
                      ...prev,
                      audience: { ...prev.audience, scope: value as CalendarAudience["scope"] },
                    }))
                  }
                >
                  <SelectTrigger className="border border-white/10 bg-white/5 text-white hover:bg-white/10 focus:ring-1 focus:ring-brand">
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent className={premiumSelectContent}>
                    {AUDIENCE_SCOPES.map((scope) => (
                      <SelectItem key={scope.value} value={scope.value} className={premiumMenuItem}>
                        {scope.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {eventForm.audience.scope === "grades" && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Grades</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {gradeOptions.map((grade) => {
                      const isSelected = eventForm.audience.gradeIds?.includes(grade.id);

                      return (
                        <label
                          key={grade.id}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border p-2.5 text-sm transition-all",
                            isSelected
                              ? "border-brand/40 bg-brand/10 text-white"
                              : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10"
                          )}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              setEventForm((prev) => ({
                                ...prev,
                                audience: {
                                  ...prev.audience,
                                  gradeIds: checked
                                    ? [...(prev.audience.gradeIds || []), grade.id]
                                    : (prev.audience.gradeIds || []).filter((id) => id !== grade.id),
                                },
                              }));
                            }}
                            className="h-4 w-4 border-white/30 data-[state=checked]:bg-brand data-[state=checked]:border-brand"
                          />
                          {grade.name}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {eventForm.audience.scope === "classes" && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Classes</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {classOptions.map((cls) => {
                      const isSelected = eventForm.audience.classGroupIds?.includes(cls.id);

                      return (
                        <label
                          key={cls.id}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border p-2.5 text-sm transition-all",
                            isSelected
                              ? "border-brand/40 bg-brand/10 text-white"
                              : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10"
                          )}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              setEventForm((prev) => ({
                                ...prev,
                                audience: {
                                  ...prev.audience,
                                  classGroupIds: checked
                                    ? [...(prev.audience.classGroupIds || []), cls.id]
                                    : (prev.audience.classGroupIds || []).filter((id) => id !== cls.id),
                                },
                              }));
                            }}
                            className="h-4 w-4 border-white/30 data-[state=checked]:bg-brand data-[state=checked]:border-brand"
                          />
                          <span className="truncate">{cls.fullLabel}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {eventForm.audience.scope === "specific_users" && (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-100/90">
                  Invite-only events are managed from the meetings workflow. This calendar keeps them visible and editable, but participant selection lives outside this screen.
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Visible To</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {AUDIENCE_ROLES.map((role) => {
                    const isSelected = eventForm.audience.roles?.includes(role.value);

                    return (
                      <label
                        key={role.value}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border p-2.5 text-sm transition-all",
                          isSelected
                            ? "border-brand/40 bg-brand/10 text-white"
                            : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10"
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            setEventForm((prev) => ({
                              ...prev,
                              audience: {
                                ...prev.audience,
                                roles: checked
                                  ? [...(prev.audience.roles || []), role.value]
                                  : (prev.audience.roles || []).filter((id) => id !== role.value),
                              },
                            }));
                          }}
                          className="h-4 w-4 border-white/30 data-[state=checked]:bg-brand data-[state=checked]:border-brand"
                        />
                        {role.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
                Recurrence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Repeats</Label>
                  <Select
                    value={eventForm.recurrence?.frequency || "none"}
                    onValueChange={(value) =>
                      setEventForm((prev) => ({
                        ...prev,
                        recurrence: {
                          ...(prev.recurrence || { interval: 1 }),
                          frequency: value as CalendarRecurrence["frequency"],
                        },
                      }))
                    }
                  >
                    <SelectTrigger className="border border-white/10 bg-white/5 text-white hover:bg-white/10 focus:ring-1 focus:ring-brand">
                      <SelectValue placeholder="Frequency" />
                    </SelectTrigger>
                    <SelectContent className={premiumSelectContent}>
                      {RECURRENCE_OPTIONS.map((rec) => (
                        <SelectItem key={rec.value} value={rec.value} className={premiumMenuItem}>
                          {rec.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Interval</Label>
                  <Input
                    type="number"
                    min={1}
                    value={eventForm.recurrence?.interval || 1}
                    onChange={(e) =>
                      setEventForm((prev) => ({
                        ...prev,
                        recurrence: {
                          ...(prev.recurrence || { frequency: "none" }),
                          interval: Number(e.target.value) || 1,
                        },
                      }))
                    }
                    className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Until</Label>
                  <Input
                    type="date"
                    value={eventForm.recurrence?.until ? toDateOnlyValue(new Date(eventForm.recurrence.until)) : ""}
                    onChange={(e) =>
                      setEventForm((prev) => ({
                        ...prev,
                        recurrence: {
                          ...(prev.recurrence || { frequency: "none" }),
                          until: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                        },
                      }))
                    }
                    className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>

              {eventForm.recurrence?.frequency === "weekly" && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Repeat On</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {WEEKDAYS.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => {
                          setEventForm((prev) => {
                            const current = prev.recurrence?.byWeekday || [];
                            const next = current.includes(day.value)
                              ? current.filter((d) => d !== day.value)
                              : [...current, day.value];
                            return {
                              ...prev,
                              recurrence: {
                                ...(prev.recurrence || { frequency: "weekly", interval: 1 }),
                                byWeekday: next,
                              },
                            };
                          });
                        }}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs transition-all",
                          eventForm.recurrence?.byWeekday?.includes(day.value)
                            ? "border-brand/40 bg-brand/10 text-white"
                            : "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:bg-white/10"
                        )}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {eventForm.recurrence?.frequency === "monthly" && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    Day Of Month (Comma-Separated)
                  </Label>
                  <Input
                    value={(eventForm.recurrence?.byMonthDay || []).join(",")}
                    onChange={(e) => {
                      const parts = e.target.value
                        .split(",")
                        .map((part) => Number(part.trim()))
                        .filter((num) => Number.isFinite(num) && num >= 1 && num <= 31);
                      setEventForm((prev) => ({
                        ...prev,
                        recurrence: {
                          ...(prev.recurrence || { frequency: "monthly", interval: 1 }),
                          byMonthDay: parts,
                        },
                      }));
                    }}
                    placeholder="e.g. 1,15,28"
                    className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
                Reminders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {REMINDER_PRESETS.map((preset) => {
                  const active = eventForm.reminders?.some((r) => r.minutesBefore === preset.minutes);
                  return (
                    <button
                      key={preset.minutes}
                      type="button"
                      onClick={() => {
                        setEventForm((prev) => {
                          const reminders = prev.reminders || [];
                          if (active) {
                            return {
                              ...prev,
                              reminders: reminders.filter((r) => r.minutesBefore !== preset.minutes),
                            };
                          }
                          return {
                            ...prev,
                            reminders: [...reminders, { minutesBefore: preset.minutes, channel: "in_app" }],
                          };
                        });
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs transition-all",
                        active
                          ? "border-brand/40 bg-brand/10 text-white"
                          : "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:bg-white/10"
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <div className="text-xs text-white/40">Reminders are delivered as in-app notifications.</div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
                Editor Delegation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Users className="h-4 w-4 text-white/50" />
                Admin can delegate at calendar or event level.
              </div>
              <Select
                value={eventForm.editorScope}
                onValueChange={(value) =>
                  setEventForm((prev) => ({
                    ...prev,
                    editorScope: value as "calendar" | "event",
                  }))
                }
              >
                <SelectTrigger className="border border-white/10 bg-white/5 text-white hover:bg-white/10 focus:ring-1 focus:ring-brand">
                  <SelectValue placeholder="Delegation scope" />
                </SelectTrigger>
                <SelectContent className={premiumSelectContent}>
                  <SelectItem value="calendar" className={premiumMenuItem}>
                    Use calendar editors
                  </SelectItem>
                  <SelectItem value="event" className={premiumMenuItem}>
                    Set event-specific editors
                  </SelectItem>
                </SelectContent>
              </Select>

              {eventForm.editorScope === "event" && (
                <div className="space-y-2">
                  {editorOptions.length === 0 ? (
                    <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/50">
                      No editors available yet.
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {editorOptions.map((editor) => {
                        const isSelected = eventForm.editorIds.includes(editor.id);

                        return (
                          <label
                            key={editor.id}
                            className={cn(
                              "flex items-center gap-3 rounded-lg border p-2.5 text-sm transition-all",
                              isSelected
                                ? "border-brand/40 bg-brand/10 text-white"
                                : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10"
                            )}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                setEventForm((prev) => ({
                                  ...prev,
                                  editorIds: checked
                                    ? [...prev.editorIds, editor.id]
                                    : prev.editorIds.filter((id) => id !== editor.id),
                                }));
                              }}
                              className="h-4 w-4 border-white/30 data-[state=checked]:bg-brand data-[state=checked]:border-brand"
                            />
                            <span className="flex-1 truncate">{editor.fullName}</span>
                            <Badge className="bg-white/10 text-white/60">{editor.role}</Badge>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap justify-between gap-2 border-t border-white/10 pt-4">
            <div className="flex items-center gap-2">
              {isEditingEvent && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleDeleteEvent(eventForm.id)}
                  className="bg-rose-600 hover:bg-rose-700"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEventModalOpen(false)}
                className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveEvent}
                className="bg-brand text-black hover:opacity-90"
              >
                {isEditingEvent ? "Save Changes" : "Create Event"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
