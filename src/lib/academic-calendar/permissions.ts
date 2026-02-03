import type { Types } from "mongoose";
import type { IAcademicCalendar } from "@/models/AcademicCalendar";
import type { IAcademicCalendarEvent } from "@/models/AcademicCalendarEvent";

export function canEditCalendar(input: {
  userId: Types.ObjectId;
  roles: string[];
  isAdmin: boolean;
  calendar: Pick<IAcademicCalendar, "editors">;
  event?: Pick<IAcademicCalendarEvent, "editorScope" | "editorIds"> | null;
}) {
  const { userId, roles, isAdmin, calendar, event } = input;
  if (isAdmin) return true;

  const allowedRoles = new Set(["teacher", "bursar"]);
  const hasAllowedRole = roles.some((role) => allowedRoles.has(role));
  if (!hasAllowedRole) return false;

  const userIdStr = String(userId);

  if (event?.editorScope === "event") {
    const eventEditors = (event.editorIds || []).map((id) => String(id));
    return eventEditors.includes(userIdStr);
  }

  const calendarEditors = (calendar.editors || []).map((id) => String(id));
  return calendarEditors.includes(userIdStr);
}
