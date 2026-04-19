import { NextRequest, NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import {
  resolveMeetingParticipantsForCreate,
  type MeetingRecipientRole,
} from "@/lib/meetings/admin";
import { serializeMeetings } from "@/lib/meetings/serialization";
import {
  buildLiveKitRoomName,
  isLiveKitConfigured,
  provisionLiveKitRoom,
} from "@/lib/meetings/livekit";
import { recordActivity } from "@/lib/audit/recordActivity";
import { AcademicCalendar } from "@/models/AcademicCalendar";
import { AcademicCalendarEvent } from "@/models/AcademicCalendarEvent";
import { Meeting } from "@/models/Meeting";
import { MeetingParticipant } from "@/models/MeetingParticipant";

const createMeetingSchema = z.object({
  calendarId: z.string().min(1, "Calendar is required"),
  title: z.string().min(1, "Title is required").max(140),
  description: z.string().optional().nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  timezone: z.string().min(1).optional(),
  kind: z
    .enum(["general", "pta", "parent_conference", "fee_consultation"])
    .optional(),
  participants: z
    .array(
      z.object({
        userId: z.string().min(1),
        role: z.enum(["parent", "teacher", "bursar"]),
        wardIds: z.array(z.string()).optional(),
      })
    )
    .min(1, "Select at least one participant"),
});

type MeetingRow = {
  _id: Types.ObjectId;
  calendarId: Types.ObjectId;
  title: string;
  description?: string | null;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  kind: string;
  status: string;
  visibility: string;
  hostUserId: Types.ObjectId;
  provider: string;
  providerStatus: string;
  providerRoomName?: string | null;
  participantCount: number;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt?: Date | null;
  cancelReason?: string | null;
};

type MeetingParticipantRow = {
  meetingId: Types.ObjectId;
  userId: Types.ObjectId;
  role: MeetingRecipientRole;
  wardIds?: Types.ObjectId[];
};

function buildMeetingQuery(req: NextRequest, schoolId: Types.ObjectId) {
  const status = req.nextUrl.searchParams.get("status") || "scheduled";
  const query: Record<string, unknown> = { schoolId };

  if (status !== "all") {
    query.status = status;
  }

  return query;
}

function meetingMatchesSearch(input: {
  title: string;
  description?: string | null;
  calendarName?: string | null;
  participantNames: string[];
  query: string;
}) {
  if (!input.query) return true;
  const haystacks = [
    input.title,
    input.description || "",
    input.calendarName || "",
    ...input.participantNames,
  ]
    .join(" ")
    .toLowerCase();

  return haystacks.includes(input.query.toLowerCase());
}

export async function GET(req: NextRequest) {
  try {
    const context = await requireSchoolAdmin();
    await connectToDatabase();

    const query = buildMeetingQuery(req, context.schoolId);
    const search = (req.nextUrl.searchParams.get("q") || "").trim();

    const meetings = await Meeting.find(query)
      .sort({ startsAt: 1 })
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
      meetings: meetings as MeetingRow[],
      participants: participants as MeetingParticipantRow[],
    });

    const filtered = serialized.filter((meeting) =>
      meetingMatchesSearch({
        title: meeting.title,
        description: meeting.description,
        calendarName: meeting.calendar.name,
        participantNames: meeting.participants.map((participant) => participant.name),
        query: search,
      })
    );

    return NextResponse.json({ success: true, data: filtered });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Failed to fetch meetings:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch meetings",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await requireSchoolAdmin();
    await connectToDatabase();

    const parsed = createMeetingSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(parsed.data.calendarId)) {
      return NextResponse.json(
        { success: false, error: "Invalid calendar." },
        { status: 400 }
      );
    }

    const startsAt = new Date(parsed.data.startsAt);
    const endsAt = new Date(parsed.data.endsAt);
    if (endsAt <= startsAt) {
      return NextResponse.json(
        { success: false, error: "End time must be after start time." },
        { status: 400 }
      );
    }

    const calendarId = new mongoose.Types.ObjectId(parsed.data.calendarId);
    const calendar = await AcademicCalendar.findOne({
      _id: calendarId,
      schoolId: context.schoolId,
    }).lean();

    if (!calendar) {
      return NextResponse.json(
        { success: false, error: "Calendar not found." },
        { status: 404 }
      );
    }

    const participants = await resolveMeetingParticipantsForCreate({
      schoolId: context.schoolId,
      participants: parsed.data.participants,
    });

    if (participants.length === 0) {
      return NextResponse.json(
        { success: false, error: "Select at least one valid participant." },
        { status: 400 }
      );
    }

    const audienceUserIds = Array.from(
      new Set(participants.map((participant) => String(participant.userId)))
    ).map((id) => new mongoose.Types.ObjectId(id));
    const audienceRoles = Array.from(
      new Set(participants.map((participant) => participant.role))
    );
    const liveKitEnabled = isLiveKitConfigured();

    let meetingId: Types.ObjectId | null = null;
    let calendarEventId: Types.ObjectId | null = null;
    let providerProvisionError: string | null = null;

    try {
      const meeting = await Meeting.create({
        schoolId: context.schoolId,
        calendarId,
        title: parsed.data.title.trim(),
        description: parsed.data.description?.trim() || null,
        startsAt,
        endsAt,
        timezone: parsed.data.timezone || "Africa/Accra",
        kind: parsed.data.kind || "general",
        status: "scheduled",
        visibility: "invite_only",
        hostUserId: context.userId,
        hostRole: "school_admin",
        provider: liveKitEnabled ? "livekit" : "none",
        providerStatus: liveKitEnabled ? "pending" : "not_configured",
        reminderMinutesBefore: [],
        participantCount: participants.length,
        createdBy: context.userId,
        updatedBy: context.userId,
      });
      meetingId = meeting._id;

      if (participants.length > 0) {
        await MeetingParticipant.insertMany(
          participants.map((participant) => ({
            meetingId: meeting._id,
            schoolId: context.schoolId,
            userId: participant.userId,
            role: participant.role,
            wardIds: participant.wardIds,
            invitedByUserId: context.userId,
            inviteStatus: "invited",
            attendanceStatus: "invited",
          }))
        );
      }

      const calendarEvent = await AcademicCalendarEvent.create({
        schoolId: context.schoolId,
        calendarId,
        academicPeriodId: calendar.academicPeriodId || null,
        title: parsed.data.title.trim(),
        description: parsed.data.description?.trim() || null,
        startDate: startsAt,
        endDate: endsAt,
        allDay: false,
        location: "EduSentrix in-app meeting",
        color: calendar.color || "#22c55e",
        status: "published",
        eventType: "meeting",
        isNonTeachingDay: false,
        audience: {
          scope: "specific_users",
          userIds: audienceUserIds,
          gradeIds: [],
          classGroupIds: [],
          roles: audienceRoles,
        },
        recurrence: null,
        editorScope: "calendar",
        editorIds: [],
        reminders: [],
        createdBy: context.userId,
        updatedBy: context.userId,
      });
      calendarEventId = calendarEvent._id;

      await Meeting.updateOne(
        { _id: meeting._id },
        {
          $set: {
            calendarEventId: calendarEvent._id,
          },
        }
      );

      if (liveKitEnabled) {
        const roomName = buildLiveKitRoomName(String(meeting._id));
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
            maxParticipants: Math.max(participants.length + 4, 8),
          });

          await Meeting.updateOne(
            { _id: meeting._id },
            {
              $set: {
                provider: "livekit",
                providerStatus: "ready",
                providerRoomName: roomName,
                updatedBy: context.userId,
              },
            }
          );
        } catch (providerError) {
          providerProvisionError =
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
                updatedBy: context.userId,
              },
            }
          );
        }
      }

      await recordActivity({
        schoolId: context.schoolId,
        userId: context.userId,
        type: "meeting.created",
        entityType: "Meeting",
        entityId: meeting._id,
        description: `Scheduled meeting: ${parsed.data.title.trim()}`,
        metadata: {
          calendarId: String(calendarId),
          participantCount: participants.length,
          kind: parsed.data.kind || "general",
          provider: liveKitEnabled ? "livekit" : "none",
          providerStatus: providerProvisionError ? "failed" : liveKitEnabled ? "ready" : "not_configured",
          providerProvisionError,
        },
      });
    } catch (error) {
      if (calendarEventId) {
        await AcademicCalendarEvent.deleteOne({ _id: calendarEventId });
      }
      if (meetingId) {
        await MeetingParticipant.deleteMany({ meetingId });
        await Meeting.deleteOne({ _id: meetingId });
      }
      throw error;
    }

    const createdMeeting = await Meeting.findById(meetingId).lean();
    const createdParticipants = await MeetingParticipant.find({ meetingId }).lean();
    if (!createdMeeting) {
      throw new Error("Meeting was created but could not be reloaded.");
    }
    const [serialized] = await serializeMeetings({
      meetings: [createdMeeting as MeetingRow],
      participants: createdParticipants as MeetingParticipantRow[],
    });

    return NextResponse.json(
      { success: true, data: serialized, providerProvisionError },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Failed to create meeting:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create meeting",
      },
      { status: 500 }
    );
  }
}
