import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { Meeting } from "@/models/Meeting";
import { MeetingParticipant } from "@/models/MeetingParticipant";
import { Student } from "@/models/Student";

type Params = Promise<{ meetingId: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  try {
    const ctx = await requireParent();
    const { meetingId } = await params;
    await connectToDatabase();
    const participant = await MeetingParticipant.findOne({
      schoolId: ctx.schoolId,
      userId: ctx.userId,
      role: "parent",
      meetingId,
    }).lean();
    if (!participant) {
      return NextResponse.json({ success: false, error: "Meeting not found" }, { status: 404 });
    }
    const meeting = await Meeting.findOne({ _id: meetingId, schoolId: ctx.schoolId }).lean();
    if (!meeting) {
      return NextResponse.json({ success: false, error: "Meeting not found" }, { status: 404 });
    }
    const wardId = participant.wardIds?.[0] ? String(participant.wardIds[0]) : null;
    const student = wardId
      ? await Student.findOne({ _id: wardId, schoolId: ctx.schoolId }).select("firstName lastName").lean()
      : null;
    const now = Date.now();
    const status =
      meeting.status === "cancelled"
        ? "cancelled"
        : meeting.endsAt && meeting.endsAt.getTime() < now
          ? "completed"
          : meeting.startsAt.getTime() <= now
            ? "in_progress"
            : "upcoming";

    return NextResponse.json({
      success: true,
      data: {
        id: String(meeting._id),
        title: meeting.title,
        description: meeting.description || null,
        organizer: null,
        wardId,
        wardName: student ? `${student.firstName} ${student.lastName}` : null,
        status,
        startTime: meeting.startsAt.toISOString(),
        endTime: meeting.endsAt?.toISOString?.() || null,
        location: meeting.provider === "livekit" ? "Online" : null,
        meetingLink: null,
        agendaHtml: meeting.description || null,
        notesHtml: null,
        attendees: [{ name: "You", role: "Parent" }],
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Failed to load meeting";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
