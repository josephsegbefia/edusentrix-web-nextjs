import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { recordActivity } from "@/lib/audit/recordActivity";
import { deleteLiveKitRoom } from "@/lib/meetings/livekit";
import { Meeting } from "@/models/Meeting";
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
    const context = await requireSchoolAdmin();
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

        await recordActivity({
          schoolId: context.schoolId,
          userId: context.userId,
          type: "meeting.cancelled",
          entityType: "Meeting",
          entityId: meeting._id,
          description: `Cancelled meeting: ${meeting.title}`,
          metadata: {
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
