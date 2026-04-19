import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { buildMeetingDisplayName } from "@/lib/meetings/admin";
import { issueLiveKitJoinToken } from "@/lib/meetings/livekit";
import { Meeting } from "@/models/Meeting";
import { MeetingParticipant } from "@/models/MeetingParticipant";
import { User } from "@/models/User";

const ALLOWED_ROLES = ["school_admin", "teacher", "bursar", "parent"] as const;

export async function POST(
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

    if (meeting.status !== "scheduled") {
      return NextResponse.json(
        { success: false, error: "Meeting is no longer active." },
        { status: 409 }
      );
    }

    if (meeting.provider !== "livekit" || !meeting.providerRoomName) {
      return NextResponse.json(
        { success: false, error: "Video room is not ready for this meeting yet." },
        { status: 409 }
      );
    }

    if (meeting.providerStatus === "ended" || meeting.providerStatus === "not_configured") {
      return NextResponse.json(
        { success: false, error: "Video room is not available for this meeting." },
        { status: 409 }
      );
    }

    const isHost = String(meeting.hostUserId) === String(context.userId);
    const participant = isHost
      ? null
      : await MeetingParticipant.findOne({
          meetingId: meetingObjectId,
          userId: context.userId,
        });

    if (!isHost && !participant) {
      return NextResponse.json(
        { success: false, error: "You are not invited to this meeting." },
        { status: 403 }
      );
    }

    if (participant?.inviteStatus === "declined") {
      return NextResponse.json(
        { success: false, error: "You have declined this meeting invitation." },
        { status: 403 }
      );
    }

    const user = await User.findById(context.userId)
      .select("_id firstName lastName name email")
      .lean();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 }
      );
    }

    const joinPayload = await issueLiveKitJoinToken({
      meetingId,
      roomName: meeting.providerRoomName,
      userId: String(context.userId),
      displayName: buildMeetingDisplayName(user),
      role: isHost ? meeting.hostRole : participant!.role,
      isHost,
    });

    if (participant && participant.inviteStatus === "invited") {
      participant.inviteStatus = "accepted";
      participant.respondedAt = participant.respondedAt || new Date();
      await participant.save();
    }

    return NextResponse.json({
      success: true,
      data: {
        provider: "livekit",
        providerStatus: meeting.providerStatus,
        roomName: joinPayload.roomName,
        serverUrl: joinPayload.serverUrl,
        token: joinPayload.token,
        identity: joinPayload.identity,
        participant: {
          displayName: buildMeetingDisplayName(user),
          role: isHost ? meeting.hostRole : participant!.role,
          isHost,
        },
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Failed to issue meeting join token:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to issue meeting join token",
      },
      { status: 500 }
    );
  }
}
