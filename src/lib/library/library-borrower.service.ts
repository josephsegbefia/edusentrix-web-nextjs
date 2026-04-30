import mongoose from "mongoose";
import { escapeRegex } from "@/lib/utils";
import type { LibraryBorrowerType } from "@/models/LibraryLoan";
import { Student } from "@/models/Student";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";

export type LibraryBorrowerSearchHit = {
  borrowerType: LibraryBorrowerType;
  borrowerId: string;
  name: string;
  avatarUrl?: string;
  subtitle?: string;
};

export async function assertBorrowerInSchool(
  schoolId: mongoose.Types.ObjectId,
  borrowerType: LibraryBorrowerType,
  borrowerId: mongoose.Types.ObjectId
): Promise<void> {
  if (borrowerType === "student") {
    const s = await Student.findOne({ _id: borrowerId, schoolId, status: "active" })
      .select("_id")
      .lean();
    if (!s) throw new Error("Active student not found in this school");
    return;
  }
  if (borrowerType === "teacher") {
    const t = await Teacher.findOne({
      _id: borrowerId,
      schoolId,
      status: { $in: ["active", "on_leave"] },
    })
      .select("_id")
      .lean();
    if (!t) throw new Error("Teacher not found in this school");
    return;
  }
  const m = await UserMembership.findOne({
    schoolId,
    userId: borrowerId,
    status: "active",
    roles: { $in: ["staff", "teacher", "school_admin", "bursar"] },
  })
    .select("_id")
    .lean();
  if (!m) throw new Error("Staff member not found in this school");
}

export async function searchLibraryBorrowers(
  schoolId: mongoose.Types.ObjectId,
  opts: {
    q: string | undefined;
    types: Array<"student" | "teacher" | "staff">;
    limit: number;
  }
): Promise<LibraryBorrowerSearchHit[]> {
  const q = opts.q?.trim() ?? "";
  const rx = q.length > 0 ? new RegExp(escapeRegex(q), "i") : null;
  const cap = opts.limit;
  const out: LibraryBorrowerSearchHit[] = [];

  async function pushStudents() {
    const filter: Record<string, unknown> = {
      schoolId,
      status: "active",
    };
    if (rx) {
      filter.$or = [
        { firstName: rx },
        { middleName: rx },
        { lastName: rx },
        { admissionNo: rx },
      ];
    }
    const rows = await Student.find(filter)
      .select({
        _id: 1,
        firstName: 1,
        lastName: 1,
        admissionNo: 1,
        classGroupId: 1,
      })
      .sort({ lastName: 1, firstName: 1 })
      .limit(cap)
      .lean();
    for (const r of rows) {
      const row = r as {
        _id: mongoose.Types.ObjectId;
        firstName?: string;
        lastName?: string;
        admissionNo?: string;
      };
      const name =
        `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() ||
        String(row.admissionNo || "Student");
      out.push({
        borrowerType: "student",
        borrowerId: String(row._id),
        name,
        subtitle: row.admissionNo ?? undefined,
      });
    }
  }

  async function pushTeachers() {
    const filter: Record<string, unknown> = {
      schoolId,
      status: { $in: ["active", "on_leave"] },
    };
    const teachers = await Teacher.find(filter)
      .select("_id userId")
      .populate("userId", "firstName lastName email avatarUrl")
      .limit(cap * 2)
      .lean();
    let n = 0;
    for (const t of teachers) {
      if (n >= cap) break;
      const row = t as {
        _id: mongoose.Types.ObjectId;
        userId?: {
          firstName?: string;
          lastName?: string;
          email?: string;
          avatarUrl?: string;
        } | null;
      };
      const u = row.userId;
      const name =
        u && `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()
          ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()
          : u?.email ?? "Teacher";
      if (rx) {
        const hay = `${name} ${u?.email ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) continue;
      }
      out.push({
        borrowerType: "teacher",
        borrowerId: String(row._id),
        name,
        avatarUrl: u?.avatarUrl ?? undefined,
        subtitle: u?.email ?? undefined,
      });
      n += 1;
    }
  }

  async function pushStaff() {
    const memberships = await UserMembership.find({
      schoolId,
      status: "active",
      roles: { $in: ["staff", "school_admin", "bursar"] },
    })
      .select("userId roles")
      .lean();

    const teacherUserIds = new Set(
      (
        await Teacher.find({
          schoolId,
          status: { $in: ["active", "on_leave"] },
        })
          .select("userId")
          .lean()
      ).map((t) => String((t as { userId: mongoose.Types.ObjectId }).userId))
    );

    const staffUserIds = memberships
      .map((m) => (m as unknown as { userId: mongoose.Types.ObjectId }).userId)
      .filter((uid) => !teacherUserIds.has(String(uid)));

    if (staffUserIds.length === 0) return;

    const users = await User.find({ _id: { $in: staffUserIds } })
      .select("firstName lastName email avatarUrl")
      .lean();

    const sorted = users
      .map((u) => {
        const row = u as {
          _id: mongoose.Types.ObjectId;
          firstName?: string;
          lastName?: string;
          email?: string;
          avatarUrl?: string;
        };
        const name =
          `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || row.email || "Staff";
        return { row, name };
      })
      .filter(({ name, row }) => {
        if (!rx) return true;
        const hay = `${name} ${row.email ?? ""}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, cap);

    for (const { row, name } of sorted) {
      out.push({
        borrowerType: "staff",
        borrowerId: String(row._id),
        name,
        avatarUrl: row.avatarUrl ?? undefined,
        subtitle: row.email ?? undefined,
      });
    }
  }

  for (const t of opts.types) {
    if (out.length >= cap) break;
    if (t === "student") await pushStudents();
    else if (t === "teacher") await pushTeachers();
    else if (t === "staff") await pushStaff();
  }

  const dedup = new Set<string>();
  const merged: LibraryBorrowerSearchHit[] = [];
  for (const h of out.sort((a, b) => a.name.localeCompare(b.name))) {
    const key = `${h.borrowerType}:${h.borrowerId}`;
    if (dedup.has(key)) continue;
    dedup.add(key);
    merged.push(h);
    if (merged.length >= cap) break;
  }

  return merged;
}
