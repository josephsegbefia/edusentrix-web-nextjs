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

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ meetingId: string }> }
) {
  try {
    const context = await requireSchoolMember({
      allowedRoles: [...ALLOWED_ROLES],
    });
    await connectToDatabase();

    const { meetingId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(meetingId)) {
      return NextResponse.json(
        { success: false, error: "Invalid meeting id." },
        { status: 400 }
      );
    }

    const meetingObjectId = new mongoose.Types.ObjectId(meetingId);
    const meeting = await Meeting.findOne({
      _id: meetingObjectId,
      schoolId: context.schoolId,
    }).lean();

    if (!meeting) {
      return NextResponse.json(
        { success: false, error: "Meeting not found." },
        { status: 404 }
      );
    }

    const participant = await MeetingParticipant.findOne({
      meetingId: meetingObjectId,
      userId: context.userId,
    })
      .select("meetingId inviteStatus attendanceStatus role respondedAt joinedAt leftAt")
      .lean();

    const isHost = String(meeting.hostUserId) === String(context.userId);
    if (!isHost && !participant) {
      return NextResponse.json(
        { success: false, error: "You are not invited to this meeting." },
        { status: 403 }
      );
    }

    const participants = await MeetingParticipant.find({
      meetingId: meetingObjectId,
    })
      .sort({ createdAt: 1 })
      .lean();

    const [serialized] = await serializeMeetings({
      meetings: [meeting as MeetingSerializeRow],
      participants: participants as MeetingSerializeParticipantRow[],
    });

    return NextResponse.json({
      success: true,
      data: {
        ...serialized,
        viewer: {
          isHost,
          role: isHost ? serialized.host.role : participant?.role || null,
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
            serialized.status === "scheduled" &&
            serialized.provider === "livekit" &&
            serialized.providerStatus === "ready" &&
            (!participant || participant.inviteStatus !== "declined"),
        },
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Failed to fetch meeting details:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch meeting details",
      },
      { status: 500 }
    );
  }
}
