import { Types } from "mongoose";
import { UserMembership } from "@/models/UserMembership";
import { User } from "@/models/User";
import { Teacher } from "@/models/Teacher";

const EDITOR_ROLES = ["teacher", "bursar"] as const;

export async function resolveEditorIds(input: {
  schoolId: Types.ObjectId;
  editorIds: string[];
}) {
  const { schoolId, editorIds } = input;
  if (!editorIds || editorIds.length === 0) return [] as Types.ObjectId[];

  const candidates = editorIds
    .map((id) => {
      try {
        return new Types.ObjectId(String(id));
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Types.ObjectId[];

  if (candidates.length === 0) return [] as Types.ObjectId[];

  const memberships = await UserMembership.find({
    schoolId,
    userId: { $in: candidates },
    roles: { $in: EDITOR_ROLES },
    status: "active",
  })
    .select("userId")
    .lean();

  const valid = new Set(
    memberships.map((m) => String((m as unknown as { userId: Types.ObjectId }).userId))
  );

  return candidates.filter((id) => valid.has(String(id)));
}

export async function fetchEligibleEditors(schoolId: Types.ObjectId) {
  const teacherDocs = await Teacher.find({ schoolId, status: "active" })
    .select("userId")
    .lean();

  const teacherUserIds = teacherDocs.map(
    (t) => (t as unknown as { userId: Types.ObjectId }).userId
  );

  const bursarMemberships = await UserMembership.find({
    schoolId,
    roles: "bursar",
    status: "active",
  })
    .select("userId")
    .lean();

  const bursarUserIds = bursarMemberships.map(
    (m) => (m as unknown as { userId: Types.ObjectId }).userId
  );

  const userIds = Array.from(new Set([...teacherUserIds, ...bursarUserIds]));
  if (userIds.length === 0) return [];

  const users = await User.find({ _id: { $in: userIds } })
    .select("firstName lastName email avatarUrl")
    .lean();

  const userMap = new Map(
    users.map((u) => [String((u as unknown as { _id: Types.ObjectId })._id), u])
  );

  return userIds
    .map((id) => {
      const user = userMap.get(String(id)) as
        | { _id: Types.ObjectId; firstName?: string; lastName?: string; email?: string; avatarUrl?: string }
        | undefined;
      if (!user) return null;
      const isBursar = bursarUserIds.some((b) => String(b) === String(id));
      const role = isBursar ? "bursar" : "teacher";
      return {
        id: String(user._id),
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        fullName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Unknown",
        email: user.email || null,
        photoUrl: user.avatarUrl || null,
        role,
      };
    })
    .filter(Boolean);
}
