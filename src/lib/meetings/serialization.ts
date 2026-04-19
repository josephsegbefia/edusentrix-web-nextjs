import { Types } from "mongoose";
import { buildMeetingDisplayName } from "@/lib/meetings/admin";
import { AcademicCalendar } from "@/models/AcademicCalendar";
import type { MeetingHostRole } from "@/models/Meeting";
import type { MeetingParticipantRole } from "@/models/MeetingParticipant";
import { Student } from "@/models/Student";
import { User } from "@/models/User";

export type MeetingSerializeRow = {
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
  hostRole: MeetingHostRole;
  provider: string;
  providerStatus: string;
  providerRoomName?: string | null;
  providerLastError?: string | null;
  participantCount: number;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt?: Date | null;
  cancelReason?: string | null;
};

export type MeetingSerializeParticipantRow = {
  meetingId: Types.ObjectId;
  userId: Types.ObjectId;
  role: MeetingParticipantRole;
  wardIds?: Types.ObjectId[];
};

type SerializableMeetingParticipant = {
  userId: string;
  role: MeetingParticipantRole;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  wardIds: string[];
  wardNames: string[];
};

export async function serializeMeetings(input: {
  meetings: MeetingSerializeRow[];
  participants: MeetingSerializeParticipantRow[];
}) {
  const calendarIds = Array.from(
    new Set(input.meetings.map((meeting) => String(meeting.calendarId)))
  ).map((id) => new Types.ObjectId(id));

  const participantUserIds = input.participants.map((participant) => participant.userId);
  const hostUserIds = input.meetings.map((meeting) => meeting.hostUserId);
  const userIds = Array.from(
    new Set([...participantUserIds, ...hostUserIds].map((id) => String(id)))
  ).map((id) => new Types.ObjectId(id));

  const wardIds = Array.from(
    new Set(
      input.participants.flatMap((participant) =>
        (participant.wardIds || []).map((wardId) => String(wardId))
      )
    )
  ).map((id) => new Types.ObjectId(id));

  const [calendars, users, students] = await Promise.all([
    calendarIds.length
      ? AcademicCalendar.find({ _id: { $in: calendarIds } })
          .select("_id name isPublished")
          .lean()
      : Promise.resolve([]),
    userIds.length
      ? User.find({ _id: { $in: userIds } })
          .select("_id firstName lastName name email avatarUrl")
          .lean()
      : Promise.resolve([]),
    wardIds.length
      ? Student.find({ _id: { $in: wardIds } })
          .select("_id firstName lastName")
          .lean()
      : Promise.resolve([]),
  ]);

  const calendarById = new Map(
    calendars.map((calendar) => [
      String((calendar as { _id: Types.ObjectId })._id),
      calendar as { _id: Types.ObjectId; name?: string | null; isPublished?: boolean },
    ])
  );
  const userById = new Map(
    users.map((user) => [
      String((user as { _id: Types.ObjectId })._id),
      user as {
        _id: Types.ObjectId;
        firstName?: string | null;
        lastName?: string | null;
        name?: string | null;
        email?: string | null;
        avatarUrl?: string | null;
      },
    ])
  );
  const wardNameById = new Map(
    students.map((student) => {
      const row = student as {
        _id: Types.ObjectId;
        firstName?: string | null;
        lastName?: string | null;
      };
      return [
        String(row._id),
        `${row.firstName || ""} ${row.lastName || ""}`.trim() || "Student",
      ];
    })
  );

  const participantsByMeetingId = new Map<string, SerializableMeetingParticipant[]>();

  input.participants.forEach((participant) => {
    const meetingId = String(participant.meetingId);
    const user = userById.get(String(participant.userId));
    const wardIdsForParticipant = (participant.wardIds || []).map((wardId) => String(wardId));
    const next: SerializableMeetingParticipant = {
      userId: String(participant.userId),
      role: participant.role,
      name: buildMeetingDisplayName(user),
      email: user?.email || null,
      avatarUrl: user?.avatarUrl || null,
      wardIds: wardIdsForParticipant,
      wardNames: wardIdsForParticipant.map((wardId) => wardNameById.get(wardId) || "Student"),
    };

    const current = participantsByMeetingId.get(meetingId) || [];
    current.push(next);
    participantsByMeetingId.set(meetingId, current);
  });

  return input.meetings.map((meeting) => {
    const meetingParticipants = (participantsByMeetingId.get(String(meeting._id)) || []).sort(
      (a, b) => a.name.localeCompare(b.name)
    );
    const calendar = calendarById.get(String(meeting.calendarId));
    const host = userById.get(String(meeting.hostUserId));

    const counts = meetingParticipants.reduce<Record<string, number>>((acc, participant) => {
      acc[participant.role] = (acc[participant.role] || 0) + 1;
      return acc;
    }, {});

    return {
      id: String(meeting._id),
      title: meeting.title,
      description: meeting.description || null,
      startsAt: meeting.startsAt.toISOString(),
      endsAt: meeting.endsAt.toISOString(),
      timezone: meeting.timezone,
      kind: meeting.kind,
      status: meeting.status,
      visibility: meeting.visibility,
      provider: meeting.provider,
      providerStatus: meeting.providerStatus,
      providerRoomName: meeting.providerRoomName || null,
      providerLastError: meeting.providerLastError || null,
      participantCount: meeting.participantCount,
      counts,
      calendar: {
        id: String(meeting.calendarId),
        name: calendar?.name || "Calendar",
        isPublished: Boolean(calendar?.isPublished),
      },
      host: {
        id: String(meeting.hostUserId),
        role: meeting.hostRole,
        name: buildMeetingDisplayName(host),
        email: host?.email || null,
      },
      participants: meetingParticipants,
      createdAt: meeting.createdAt.toISOString(),
      updatedAt: meeting.updatedAt.toISOString(),
      cancelledAt: meeting.cancelledAt ? meeting.cancelledAt.toISOString() : null,
      cancelReason: meeting.cancelReason || null,
    };
  });
}
