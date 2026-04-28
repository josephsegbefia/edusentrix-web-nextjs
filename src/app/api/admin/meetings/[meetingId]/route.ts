import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  requireMeetingsPermission,
} from "@/lib/meetings/requireMeetingsPermission";
import { recordActivity } from "@/lib/audit/recordActivity";
import { meetingsActorAuditMetadata } from "@/lib/meetings/meetings-actor-audit-metadata";
import { deleteLiveKitRoom } from "@/lib/meetings/livekit";
import { Meeting } from "@/models/Meeting";
import { MeetingParticipant } from "@/models/MeetingParticipant";
import { AcademicCalendarEvent } from "@/models/AcademicCalendarEvent";

const updateSchema = z.object({
  action: z.enum(["cancel"]),
  reason: z.string().optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ meetingId: string }> }
) {
  try {
    const context = await requireMeetingsPermission("meetings.cancel");
    await connectToDatabase();

    const { meetingId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(meetingId)) {
      return NextResponse.json(
        { success: false, error: "Invalid meeting id." },
        { status: 400 }
      );
    }

    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid payload.", details: parsed.error.flatten() },
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

    if (parsed.data.action === "cancel") {
      if (meeting.status !== "cancelled") {
        meeting.status = "cancelled";
        meeting.cancelledAt = new Date();
        meeting.cancelledBy = context.userId;
        meeting.cancelReason = parsed.data.reason?.trim() || null;
        meeting.updatedBy = context.userId;
        await meeting.save();

        if (meeting.provider === "livekit" && meeting.providerRoomName) {
          try {
            await deleteLiveKitRoom(meeting.providerRoomName);
            meeting.providerStatus = "ended";
            await meeting.save();
          } catch (providerError) {
            console.error("Failed to delete LiveKit room during meeting cancellation:", providerError);
          }
        }

        if (meeting.calendarEventId) {
          await AcademicCalendarEvent.updateOne(
            { _id: meeting.calendarEventId },
            {
              $set: {
                status: "cancelled",
                updatedBy: context.userId,
              },
            }
          );
        }

        const cancelActorMeta = await meetingsActorAuditMetadata(context, "meeting.cancelled");
        await recordActivity({
          schoolId: context.schoolId,
          userId: context.userId,
          type: "meeting.cancelled",
          entityType: "Meeting",
          entityId: meeting._id,
          description: `Cancelled meeting: ${meeting.title}`,
          metadata: {
            ...cancelActorMeta,
            reason: meeting.cancelReason,
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Failed to update meeting:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update meeting",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ meetingId: string }> }
) {
  try {
    const context = await requireMeetingsPermission("meetings.edit");
    await connectToDatabase();

    const { meetingId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(meetingId)) {
      return NextResponse.json(
        { success: false, error: "Invalid meeting id." },
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

    if (meeting.status !== "cancelled") {
      return NextResponse.json(
        {
          success: false,
          error: "Only cancelled meetings can be deleted.",
        },
        { status: 400 }
      );
    }

    const title = meeting.title;
    const meetingObjectId = meeting._id;
    const calendarEventId = meeting.calendarEventId;

    if (meeting.provider === "livekit" && meeting.providerRoomName) {
      try {
        await deleteLiveKitRoom(meeting.providerRoomName);
      } catch (providerError) {
        console.error("Failed to delete LiveKit room when removing meeting:", providerError);
      }
    }

    await MeetingParticipant.deleteMany({ meetingId: meeting._id });

    if (calendarEventId) {
      await AcademicCalendarEvent.deleteOne({ _id: calendarEventId });
    }

    await Meeting.deleteOne({ _id: meetingObjectId });

    const deleteActorMeta = await meetingsActorAuditMetadata(context, "meeting.deleted");
    await recordActivity({
      schoolId: context.schoolId,
      userId: context.userId,
      type: "meeting.deleted",
      entityType: "Meeting",
      entityId: meetingObjectId,
      description: `Deleted cancelled meeting: ${title}`,
      metadata: deleteActorMeta,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Failed to delete meeting:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete meeting",
      },
      { status: 500 }
    );
  }
}
