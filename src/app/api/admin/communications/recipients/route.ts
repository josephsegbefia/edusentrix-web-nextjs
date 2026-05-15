import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Guardian } from "@/models/Guardian";
import { Student } from "@/models/Student";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";

type RecipientKind = "parent" | "teacher" | "student" | "staff";

type UserRow = {
  _id: mongoose.Types.ObjectId;
  email?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function displayName(user?: UserRow | null, fallback?: string | null) {
  const parts = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  return user?.name || parts || fallback || user?.email || "Unnamed recipient";
}

function matchesUserQuery(q: string) {
  if (!q) return {};
  const regex = { $regex: escapeRegex(q), $options: "i" };
  return {
    $or: [
      { name: regex },
      { firstName: regex },
      { lastName: regex },
      { email: regex },
      { phone: regex },
    ],
  };
}

function serializeUser(user: UserRow, role: RecipientKind, meta?: Record<string, unknown>) {
  return {
    id: String(user._id),
    userId: String(user._id),
    role,
    name: displayName(user),
    email: user.email ?? null,
    phone: user.phone ?? null,
    avatarUrl: user.avatarUrl ?? null,
    meta: meta ?? {},
  };
}

async function findTeachers(schoolId: mongoose.Types.ObjectId, q: string, limit: number) {
  const teachers = await Teacher.find({ schoolId, status: { $ne: "terminated" } })
    .select("userId")
    .lean<Array<{ userId: mongoose.Types.ObjectId }>>();
  const users = await User.find({
    _id: { $in: teachers.map((teacher) => teacher.userId) },
    ...matchesUserQuery(q),
  }).select("_id email name firstName lastName phone avatarUrl role").limit(limit).lean<UserRow[]>();
  return users.map((user) => serializeUser(user, "teacher"));
}

async function findStaff(schoolId: mongoose.Types.ObjectId, q: string, limit: number) {
  const users = await User.find({
    schoolId,
    role: { $in: ["school_admin", "billing_owner", "bursar", "staff"] },
    ...matchesUserQuery(q),
  }).select("_id email name firstName lastName phone avatarUrl role").limit(limit).lean<UserRow[]>();
  return users.map((user) => serializeUser(user, "staff", { staffRole: user.role ?? null }));
}

async function findStudents(schoolId: mongoose.Types.ObjectId, q: string, limit: number) {
  const regex = q ? { $regex: escapeRegex(q), $options: "i" } : null;
  const studentQuery: Record<string, unknown> = { schoolId, status: "active", userId: { $ne: null } };
  if (regex) {
    studentQuery.$or = [{ firstName: regex }, { lastName: regex }, { admissionNo: regex }];
  }
  const students = await Student.find(studentQuery)
    .select("_id userId firstName lastName admissionNo gradeId classGroupId")
    .limit(limit)
    .lean<Array<{
      _id: mongoose.Types.ObjectId;
      userId: mongoose.Types.ObjectId;
      firstName: string;
      lastName: string;
      admissionNo?: string | null;
      gradeId?: mongoose.Types.ObjectId | null;
      classGroupId?: mongoose.Types.ObjectId | null;
    }>>();
  const users = await User.find({ _id: { $in: students.map((student) => student.userId) } })
    .select("_id email name firstName lastName phone avatarUrl role")
    .lean<UserRow[]>();
  const userMap = new Map(users.map((user) => [String(user._id), user]));
  return students.map((student) => {
    const user = userMap.get(String(student.userId));
    return serializeUser(user ?? {
      _id: student.userId,
      name: `${student.firstName} ${student.lastName}`,
    }, "student", {
      studentId: String(student._id),
      admissionNo: student.admissionNo ?? null,
    });
  });
}

async function findParents(schoolId: mongoose.Types.ObjectId, q: string, limit: number) {
  const students = await Student.find({ schoolId, status: "active" })
    .select("_id firstName lastName")
    .lean<Array<{ _id: mongoose.Types.ObjectId; firstName: string; lastName: string }>>();
  const studentIds = students.map((student) => student._id);
  if (!studentIds.length) return [];

  const regex = q ? { $regex: escapeRegex(q), $options: "i" } : null;
  const matchingUsers = regex
    ? await User.find(matchesUserQuery(q))
        .select("_id")
        .limit(limit * 3)
        .lean<Array<{ _id: mongoose.Types.ObjectId }>>()
    : [];
  const guardianQuery: Record<string, unknown> = { studentId: { $in: studentIds } };
  if (regex) {
    guardianQuery.$or = [
      { email: regex },
      { phone: regex },
      { userId: { $in: matchingUsers.map((user) => user._id) } },
    ];
  }
  const guardians = await Guardian.find(guardianQuery)
    .select("_id studentId userId email phone relationship photoUrl")
    .limit(limit * 3)
    .lean<Array<{
      _id: mongoose.Types.ObjectId;
      studentId: mongoose.Types.ObjectId;
      userId: mongoose.Types.ObjectId;
      email?: string | null;
      phone?: string | null;
      photoUrl?: string | null;
      relationship?: string | null;
    }>>();
  const users = await User.find({
    _id: { $in: guardians.map((guardian) => guardian.userId) },
  }).select("_id email name firstName lastName phone avatarUrl role").lean<UserRow[]>();
  const userMap = new Map(users.map((user) => [String(user._id), user]));
  const studentMap = new Map(students.map((student) => [String(student._id), student]));
  const seen = new Set<string>();
  const results = [];

  for (const guardian of guardians) {
    if (seen.has(String(guardian.userId))) continue;
    const user = userMap.get(String(guardian.userId));
    const searchable = `${displayName(user, guardian.email)} ${guardian.email ?? ""} ${guardian.phone ?? ""}`.toLowerCase();
    if (q && !searchable.includes(q.toLowerCase())) continue;
    seen.add(String(guardian.userId));
    const student = studentMap.get(String(guardian.studentId));
    results.push(serializeUser(user ?? {
      _id: guardian.userId,
      email: guardian.email,
      phone: guardian.phone,
      avatarUrl: guardian.photoUrl,
    }, "parent", {
      guardianId: String(guardian._id),
      relationship: guardian.relationship ?? null,
      linkedStudent: student ? `${student.firstName} ${student.lastName}` : null,
    }));
    if (results.length >= limit) break;
  }

  return results;
}

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("communications");
    await connectToDatabase();
    const url = new URL(req.url);
    const kind = (url.searchParams.get("kind") || "teacher") as RecipientKind;
    const q = url.searchParams.get("q")?.trim() || "";
    const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") || 10)));
    const schoolObjectId = new mongoose.Types.ObjectId(String(schoolId));

    const items =
      kind === "teacher" ? await findTeachers(schoolObjectId, q, limit) :
      kind === "parent" ? await findParents(schoolObjectId, q, limit) :
      kind === "student" ? await findStudents(schoolObjectId, q, limit) :
      kind === "staff" ? await findStaff(schoolObjectId, q, limit) :
      [];

    return Response.json({ success: true, data: { items } });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to search recipients" },
      { status: 500 },
    );
  }
}
