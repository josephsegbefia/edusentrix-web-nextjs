import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import {
  serializeMeetings,
  type MeetingSerializeParticipantRow,
  type MeetingSerializeRow,
} from "@/lib/meetings/serialization";
import { Meeting } from "@/models/Meeting";
import { MeetingParticipant } from "@/models/MeetingParticipant";

const ALLOWED_ROLES = ["school_admin", "teacher", "bursar", "parent"] as const;

function buildMeetingSearchText(meeting: Awaited<ReturnType<typeof serializeMeetings>>[number]) {
  return [
    meeting.title,
    meeting.description || "",
    meeting.calendar.name,
    meeting.host.name,
    ...meeting.participants.map((participant) => participant.name),
    ...meeting.participants.flatMap((participant) => participant.wardNames),
  ]
    .join(" ")
    .toLowerCase();
}

export async function GET(req: NextRequest) {
  try {
    const context = await requireSchoolMember({
      allowedRoles: [...ALLOWED_ROLES],
    });
    await connectToDatabase();

    const status = req.nextUrl.searchParams.get("status") || "all";
    const search = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();

    const directParticipants = await MeetingParticipant.find({
      schoolId: context.schoolId,
      userId: context.userId,
    })
      .select("meetingId inviteStatus attendanceStatus role respondedAt joinedAt leftAt")
      .lean();

    const participantMeetingIds = Array.from(
      new Set(directParticipants.map((participant) => String(participant.meetingId)))
    )
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const orQuery: Array<Record<string, unknown>> = [{ hostUserId: context.userId }];
    if (participantMeetingIds.length > 0) {
      orQuery.push({ _id: { $in: participantMeetingIds } });
    }

    const query: Record<string, unknown> = {
      schoolId: context.schoolId,
      $or: orQuery,
    };
    if (status !== "all") {
      query.status = status;
    }

    const meetings = await Meeting.find(query)
      .sort({ startsAt: 1, createdAt: -1 })
      .limit(100)
      .lean();

    if (meetings.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const meetingIds = meetings.map((meeting) => meeting._id);
    const participants = await MeetingParticipant.find({
      meetingId: { $in: meetingIds },
    })
      .sort({ createdAt: 1 })
      .lean();

    const serialized = await serializeMeetings({
      meetings: meetings as MeetingSerializeRow[],
      participants: participants as MeetingSerializeParticipantRow[],
    });

    const viewerByMeetingId = new Map(
      directParticipants.map((participant) => [String(participant.meetingId), participant])
    );

    const filtered = serialized
      .filter((meeting) => !search || buildMeetingSearchText(meeting).includes(search))
      .map((meeting) => {
        const isHost = meeting.host.id === String(context.userId);
        const participant = viewerByMeetingId.get(meeting.id);

        return {
          ...meeting,
          viewer: {
            isHost,
            role: isHost ? meeting.host.role : participant?.role || null,
            inviteStatus: isHost ? "accepted" : participant?.inviteStatus || "invited",
            attendanceStatus: isHost
              ? "invited"
              : participant?.attendanceStatus || "invited",
            respondedAt: participant?.respondedAt
              ? new Date(participant.respondedAt).toISOString()
              : null,
            joinedAt: participant?.joinedAt ? new Date(participant.joinedAt).toISOString() : null,
            leftAt: participant?.leftAt ? new Date(participant.leftAt).toISOString() : null,
            canJoin:
              meeting.status === "scheduled" &&
              meeting.provider === "livekit" &&
              meeting.providerStatus === "ready" &&
              (!participant || participant.inviteStatus !== "declined"),
          },
        };
      });

    return NextResponse.json({ success: true, data: filtered });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Failed to fetch school member meetings:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch school member meetings",
      },
      { status: 500 }
    );
  }
}
