import { Types } from "mongoose";
import { Guardian } from "@/models/Guardian";
import { Student } from "@/models/Student";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";

export type MeetingRecipientRole = "parent" | "teacher" | "bursar";

type BasicUser = {
  _id: Types.ObjectId;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

export type MeetingRecipientOption = {
  userId: string;
  role: MeetingRecipientRole;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  wardIds: string[];
  wardNames: string[];
};

export type ResolvedMeetingParticipant = {
  userId: Types.ObjectId;
  role: MeetingRecipientRole;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  wardIds: Types.ObjectId[];
  wardNames: string[];
};

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value)))
  );
}

function buildRegexSafeQuery(query?: string | null) {
  return (query || "").trim().toLowerCase();
}

function matchesQuery(values: Array<string | null | undefined>, query: string) {
  if (!query) return true;
  return values.some((value) => value?.toLowerCase().includes(query));
}

export function buildMeetingDisplayName(
  user?: {
    firstName?: string | null;
    lastName?: string | null;
    name?: string | null;
    email?: string | null;
  } | null,
  fallback = "Unknown user"
) {
  if (!user) return fallback;
  const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return fullName || user.name?.trim() || user.email?.trim() || fallback;
}

export async function searchMeetingRecipients(input: {
  schoolId: Types.ObjectId;
  role: MeetingRecipientRole;
  query?: string | null;
  limit?: number;
  all?: boolean;
}) {
  const query = buildRegexSafeQuery(input.query);
  const limit = input.all
    ? Math.max(1, Math.min(input.limit || 5000, 5000))
    : Math.max(1, Math.min(input.limit || 20, 50));

  if (input.role === "teacher") {
    const teachers = await Teacher.find({
      schoolId: input.schoolId,
      status: "active",
    })
      .select("userId")
      .lean();

    const userIds = uniqueStrings(
      teachers.map((teacher) => String((teacher as { userId?: Types.ObjectId | null }).userId || ""))
    ).map((id) => new Types.ObjectId(id));

    if (userIds.length === 0) return [] as MeetingRecipientOption[];

    const users = (await User.find({ _id: { $in: userIds } })
      .select("_id firstName lastName name email avatarUrl")
      .lean()) as BasicUser[];

    return users
      .map((user) => ({
        userId: String(user._id),
        role: "teacher" as const,
        name: buildMeetingDisplayName(user),
        email: user.email || null,
        avatarUrl: user.avatarUrl || null,
        wardIds: [],
        wardNames: [],
      }))
      .filter((user) => matchesQuery([user.name, user.email], query))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit);
  }

  if (input.role === "bursar") {
    const memberships = await UserMembership.find({
      schoolId: input.schoolId,
      status: "active",
      roles: "bursar",
    })
      .select("userId")
      .lean();

    const userIds = uniqueStrings(
      memberships.map((membership) =>
        String((membership as { userId?: Types.ObjectId | null }).userId || "")
      )
    ).map((id) => new Types.ObjectId(id));

    if (userIds.length === 0) return [] as MeetingRecipientOption[];

    const users = (await User.find({ _id: { $in: userIds } })
      .select("_id firstName lastName name email avatarUrl")
      .lean()) as BasicUser[];

    return users
      .map((user) => ({
        userId: String(user._id),
        role: "bursar" as const,
        name: buildMeetingDisplayName(user),
        email: user.email || null,
        avatarUrl: user.avatarUrl || null,
        wardIds: [],
        wardNames: [],
      }))
      .filter((user) => matchesQuery([user.name, user.email], query))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit);
  }

  const students = await Student.find({
    schoolId: input.schoolId,
    status: "active",
  })
    .select("_id firstName lastName")
    .lean();

  const studentIds = students.map((student) => (student as { _id: Types.ObjectId })._id);
  if (studentIds.length === 0) return [] as MeetingRecipientOption[];

  const studentNameById = new Map(
    students.map((student) => {
      const row = student as {
        _id: Types.ObjectId;
        firstName?: string | null;
        lastName?: string | null;
      };
      return [String(row._id), `${row.firstName || ""} ${row.lastName || ""}`.trim()];
    })
  );

  const guardians = await Guardian.find({
    studentId: { $in: studentIds },
  })
    .select("userId studentId")
    .lean();

  const wardIdsByUser = new Map<string, string[]>();
  const wardNamesByUser = new Map<string, string[]>();

  guardians.forEach((guardian) => {
    const row = guardian as { userId: Types.ObjectId; studentId: Types.ObjectId };
    const userId = String(row.userId);
    const studentId = String(row.studentId);
    const studentName = studentNameById.get(studentId) || "Student";

    wardIdsByUser.set(userId, uniqueStrings([...(wardIdsByUser.get(userId) || []), studentId]));
    wardNamesByUser.set(
      userId,
      uniqueStrings([...(wardNamesByUser.get(userId) || []), studentName])
    );
  });

  const userIds = Array.from(wardIdsByUser.keys()).map((id) => new Types.ObjectId(id));
  if (userIds.length === 0) return [] as MeetingRecipientOption[];

  const users = (await User.find({ _id: { $in: userIds } })
    .select("_id firstName lastName name email avatarUrl")
    .lean()) as BasicUser[];

  return users
    .map((user) => {
      const userId = String(user._id);
      return {
        userId,
        role: "parent" as const,
        name: buildMeetingDisplayName(user),
        email: user.email || null,
        avatarUrl: user.avatarUrl || null,
        wardIds: wardIdsByUser.get(userId) || [],
        wardNames: wardNamesByUser.get(userId) || [],
      };
    })
    .filter((user) =>
      matchesQuery([user.name, user.email, ...user.wardNames], query)
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);
}

export async function resolveMeetingParticipantsForCreate(input: {
  schoolId: Types.ObjectId;
  participants: Array<{
    userId: string;
    role: MeetingRecipientRole;
    wardIds?: string[];
  }>;
}) {
  const merged = new Map<
    string,
    {
      userId: string;
      role: MeetingRecipientRole;
      wardIds: string[];
    }
  >();

  input.participants.forEach((participant) => {
    if (!Types.ObjectId.isValid(participant.userId)) return;
    const key = `${participant.role}:${participant.userId}`;
    const existing = merged.get(key);
    merged.set(key, {
      userId: participant.userId,
      role: participant.role,
      wardIds: uniqueStrings([
        ...(existing?.wardIds || []),
        ...((participant.wardIds || []).filter((wardId) =>
          Types.ObjectId.isValid(wardId)
        )),
      ]),
    });
  });

  const uniqueParticipants = Array.from(merged.values());
  if (uniqueParticipants.length === 0) {
    return [] as ResolvedMeetingParticipant[];
  }

  const participantUserIds = uniqueParticipants.map(
    (participant) => new Types.ObjectId(participant.userId)
  );

  const users = (await User.find({ _id: { $in: participantUserIds } })
    .select("_id firstName lastName name email avatarUrl")
    .lean()) as BasicUser[];
  const userById = new Map(users.map((user) => [String(user._id), user]));

  const teacherIds = uniqueParticipants
    .filter((participant) => participant.role === "teacher")
    .map((participant) => new Types.ObjectId(participant.userId));
  const bursarIds = uniqueParticipants
    .filter((participant) => participant.role === "bursar")
    .map((participant) => new Types.ObjectId(participant.userId));
  const parentIds = uniqueParticipants
    .filter((participant) => participant.role === "parent")
    .map((participant) => new Types.ObjectId(participant.userId));

  const [teachers, bursars, students] = await Promise.all([
    teacherIds.length
      ? Teacher.find({
          schoolId: input.schoolId,
          status: "active",
          userId: { $in: teacherIds },
        })
          .select("userId")
          .lean()
      : Promise.resolve([]),
    bursarIds.length
      ? UserMembership.find({
          schoolId: input.schoolId,
          status: "active",
          roles: "bursar",
          userId: { $in: bursarIds },
        })
          .select("userId")
          .lean()
      : Promise.resolve([]),
    parentIds.length
      ? Student.find({
          schoolId: input.schoolId,
          status: "active",
        })
          .select("_id firstName lastName")
          .lean()
      : Promise.resolve([]),
  ]);

  const validTeacherIds = new Set(
    teachers.map((teacher) => String((teacher as { userId: Types.ObjectId }).userId))
  );
  const validBursarIds = new Set(
    bursars.map((membership) => String((membership as { userId: Types.ObjectId }).userId))
  );

  const schoolStudentIds = students.map((student) => (student as { _id: Types.ObjectId })._id);
  const studentNameById = new Map(
    students.map((student) => {
      const row = student as {
        _id: Types.ObjectId;
        firstName?: string | null;
        lastName?: string | null;
      };
      return [String(row._id), `${row.firstName || ""} ${row.lastName || ""}`.trim()];
    })
  );

  const guardians = parentIds.length
    ? await Guardian.find({
        userId: { $in: parentIds },
        studentId: { $in: schoolStudentIds },
      })
        .select("userId studentId")
        .lean()
    : [];

  const parentWardIdsByUser = new Map<string, string[]>();
  guardians.forEach((guardian) => {
    const row = guardian as { userId: Types.ObjectId; studentId: Types.ObjectId };
    const userId = String(row.userId);
    const wardId = String(row.studentId);
    parentWardIdsByUser.set(
      userId,
      uniqueStrings([...(parentWardIdsByUser.get(userId) || []), wardId])
    );
  });

  return uniqueParticipants.map((participant) => {
    const user = userById.get(participant.userId);
    if (!user) {
      throw new Error("One or more selected users no longer exist.");
    }

    if (participant.role === "teacher" && !validTeacherIds.has(participant.userId)) {
      throw new Error(`${buildMeetingDisplayName(user)} is not an active teacher in this school.`);
    }

    if (participant.role === "bursar" && !validBursarIds.has(participant.userId)) {
      throw new Error(`${buildMeetingDisplayName(user)} is not an active bursar in this school.`);
    }

    let wardIds: string[] = [];
    if (participant.role === "parent") {
      const availableWardIds = parentWardIdsByUser.get(participant.userId) || [];
      if (availableWardIds.length === 0) {
        throw new Error(`${buildMeetingDisplayName(user)} is not linked to an active student in this school.`);
      }

      wardIds =
        participant.wardIds.length > 0
          ? participant.wardIds.filter((wardId) => availableWardIds.includes(wardId))
          : availableWardIds;

      if (wardIds.length === 0) {
        throw new Error(`${buildMeetingDisplayName(user)} is not linked to the selected wards.`);
      }
    }

    return {
      userId: new Types.ObjectId(participant.userId),
      role: participant.role,
      name: buildMeetingDisplayName(user),
      email: user.email || null,
      avatarUrl: user.avatarUrl || null,
      wardIds: wardIds.map((wardId) => new Types.ObjectId(wardId)),
      wardNames: wardIds
        .map((wardId) => studentNameById.get(wardId) || "Student")
        .filter(Boolean),
    };
  });
}
