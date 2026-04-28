import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  requireMeetingsPermission,
} from "@/lib/meetings/requireMeetingsPermission";
import {
  serializeMeetings,
  type MeetingSerializeParticipantRow,
  type MeetingSerializeRow,
} from "@/lib/meetings/serialization";
import {
  buildLiveKitRoomName,
  isLiveKitConfigured,
  provisionLiveKitRoom,
} from "@/lib/meetings/livekit";
import { recordActivity } from "@/lib/audit/recordActivity";
import { meetingsActorAuditMetadata } from "@/lib/meetings/meetings-actor-audit-metadata";
import { Meeting } from "@/models/Meeting";
import { MeetingParticipant } from "@/models/MeetingParticipant";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ meetingId: string }> }
) {
  try {
    const context = await requireMeetingsPermission("meetings.start");
    await connectToDatabase();

    const { meetingId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(meetingId)) {
      return NextResponse.json(
        { success: false, error: "Invalid meeting id." },
        { status: 400 }
      );
    }

    if (!isLiveKitConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: "LiveKit is not configured (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET).",
        },
        { status: 400 }
      );
    }

    const meeting = await Meeting.findOne({
      _id: new mongoose.Types.ObjectId(meetingId),
      schoolId: context.schoolId,
    });

    if (!meeting) {
      return NextResponse.json(
        { success: false, error: "Meeting not found." },
        { status: 404 }
      );
    }

    if (meeting.status !== "scheduled") {
      return NextResponse.json(
        { success: false, error: "Only scheduled meetings can be provisioned." },
        { status: 400 }
      );
    }

    if (meeting.provider !== "livekit") {
      return NextResponse.json(
        { success: false, error: "This meeting is not set up for LiveKit." },
        { status: 400 }
      );
    }

    if (meeting.providerStatus === "ready") {
      return NextResponse.json(
        { success: false, error: "Video room is already ready." },
        { status: 400 }
      );
    }

    if (!["failed", "pending"].includes(meeting.providerStatus)) {
      return NextResponse.json(
        { success: false, error: "Video room cannot be provisioned in this state." },
        { status: 400 }
      );
    }

    const roomName =
      meeting.providerRoomName?.trim() || buildLiveKitRoomName(String(meeting._id));

    const participantRows = await MeetingParticipant.find({ meetingId: meeting._id }).lean();
    const maxParticipants = Math.max(participantRows.length + 4, 8);

    try {
      await provisionLiveKitRoom({
        roomName,
        metadata: {
          meetingId: String(meeting._id),
          schoolId: String(context.schoolId),
          title: meeting.title,
          kind: meeting.kind,
          startsAt: meeting.startsAt.toISOString(),
          endsAt: meeting.endsAt.toISOString(),
        },
        maxParticipants,
      });

      await Meeting.updateOne(
        { _id: meeting._id },
        {
          $set: {
            provider: "livekit",
            providerStatus: "ready",
            providerRoomName: roomName,
            providerLastError: null,
            updatedBy: context.userId,
          },
        }
      );
    } catch (providerError) {
      const message =
        providerError instanceof Error
          ? providerError.message
          : "LiveKit room provisioning failed.";

      await Meeting.updateOne(
        { _id: meeting._id },
        {
          $set: {
            provider: "livekit",
            providerStatus: "failed",
            providerRoomName: roomName,
            providerLastError: message,
            updatedBy: context.userId,
          },
        }
      );

      const failMeta = await meetingsActorAuditMetadata(context, "meeting.livekit_provision_failed");
      await recordActivity({
        schoolId: context.schoolId,
        userId: context.userId,
        type: "meeting.livekit_provision_failed",
        entityType: "Meeting",
        entityId: meeting._id,
        description: `LiveKit provisioning failed: ${meeting.title}`,
        metadata: {
          ...failMeta,
          providerRoomName: roomName,
          error: message,
        },
      });

      return NextResponse.json(
        { success: false, error: message, providerProvisionError: message },
        { status: 502 }
      );
    }

    const updated = await Meeting.findById(meeting._id).lean();
    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Meeting missing after update." },
        { status: 500 }
      );
    }

    const participants = await MeetingParticipant.find({ meetingId: meeting._id }).lean();
    const [serialized] = await serializeMeetings({
      meetings: [updated as MeetingSerializeRow],
      participants: participants as MeetingSerializeParticipantRow[],
    });

    const okMeta = await meetingsActorAuditMetadata(context, "meeting.livekit_ready");
    await recordActivity({
      schoolId: context.schoolId,
      userId: context.userId,
      type: "meeting.livekit_ready",
      entityType: "Meeting",
      entityId: meeting._id,
      description: `LiveKit room ready: ${meeting.title}`,
      metadata: {
        ...okMeta,
        providerRoomName: roomName,
      },
    });

    return NextResponse.json({ success: true, data: serialized });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Failed to provision LiveKit room:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to provision LiveKit room",
      },
      { status: 500 }
    );
  }
}
