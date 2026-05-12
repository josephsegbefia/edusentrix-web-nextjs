import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { Meeting } from "@/models/Meeting";
import { MeetingParticipant } from "@/models/MeetingParticipant";
import { Student } from "@/models/Student";

function meetingStatus(startsAt: Date, endsAt: Date | null | undefined, status?: string) {
  if (status === "cancelled") return "cancelled";
  const now = Date.now();
  if (endsAt && endsAt.getTime() < now) return "completed";
  if (startsAt.getTime() <= now && (!endsAt || endsAt.getTime() >= now)) return "in_progress";
  return "upcoming";
}

export async function GET() {
  try {
    const ctx = await requireParent();
    await connectToDatabase();
    const participants = await MeetingParticipant.find({
      schoolId: ctx.schoolId,
      userId: ctx.userId,
      role: "parent",
    })
      .sort({ createdAt: -1 })
      .lean();
    const meetings = await Meeting.find({
      _id: { $in: participants.map((p) => p.meetingId) },
      schoolId: ctx.schoolId,
    }).lean();
    const meetingById = new Map(meetings.map((m) => [String(m._id), m]));
    const wardIds = [...new Set(participants.flatMap((p) => (p.wardIds ?? []).map(String)))];
    const students = await Student.find({ _id: { $in: wardIds }, schoolId: ctx.schoolId })
      .select("_id firstName lastName")
      .lean();
    const studentById = new Map(students.map((s) => [String(s._id), `${s.firstName} ${s.lastName}`]));

    const rows = participants
      .map((p) => {
        const meeting = meetingById.get(String(p.meetingId));
        if (!meeting) return null;
        const wardId = p.wardIds?.[0] ? String(p.wardIds[0]) : null;
        const status = meetingStatus(meeting.startsAt, meeting.endsAt, meeting.status);
        return {
          id: String(meeting._id),
          title: meeting.title,
          description: meeting.description || null,
          organizer: null,
          wardId,
          wardName: wardId ? studentById.get(wardId) || null : null,
          status,
          startTime: meeting.startsAt.toISOString(),
          endTime: meeting.endsAt?.toISOString?.() || null,
          location: meeting.provider === "livekit" ? "Online" : null,
          meetingLink: null,
          agendaHtml: meeting.description || null,
          notesHtml: null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    return NextResponse.json({
      success: true,
      data: {
        upcoming: rows.filter((row) => row.status === "upcoming" || row.status === "in_progress"),
        past: rows.filter((row) => row.status === "completed" || row.status === "cancelled").reverse(),
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Failed to load meetings";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
