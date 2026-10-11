import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherDocument } from "@/models/TeacherDocument";
import { Teacher } from "@/models/Teacher";

const TYPES = new Set(["contract", "certificate", "license", "id", "resume", "other"]);

export async function GET(req: NextRequest) {
  const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("documents");
  await connectToDatabase();
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || "20")));
  const type = url.searchParams.get("type");
  const teacherId = url.searchParams.get("teacherId");
  const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
  const query: Record<string, unknown> = { schoolId };
  const schoolTeachers = await Teacher.find({ schoolId }).select("_id").lean();
  query.teacherId = { $in: schoolTeachers.map((teacher) => teacher._id) };
  if (type && TYPES.has(type)) query.type = type;
  if (teacherId) {
    if (!mongoose.Types.ObjectId.isValid(teacherId)) return NextResponse.json({ success: false, error: "Invalid teacher id." }, { status: 400 });
    query.teacherId = teacherId;
  }
  if (q) query.name = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  const [total, rows] = await Promise.all([
    TeacherDocument.countDocuments(query),
    TeacherDocument.find(query).sort({ expiryDate: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  const teacherIds = rows.map((row) => row.teacherId).filter(Boolean);
  const teachers = await Teacher.find({ _id: { $in: teacherIds }, schoolId }).select("_id userId").populate("userId", "firstName lastName").lean();
  const names = new Map(teachers.map((teacher) => [String(teacher._id), `${teacher.userId?.firstName || ""} ${teacher.userId?.lastName || ""}`.trim() || "Teacher"]));
  const now = Date.now();
  return NextResponse.json({
    success: true,
    data: rows.filter((row) => names.has(String(row.teacherId))).map((row) => {
      const expiry = row.expiryDate ? new Date(row.expiryDate) : null;
      const expiryStatus = !expiry ? null : expiry.getTime() < now ? "expired" : expiry.getTime() <= now + 30 * 86400000 ? "expiring_soon" : "valid";
      return {
        id: String(row._id), name: row.name, type: row.type, category: row.category || null,
        fileMime: row.fileMime || null, fileSize: row.fileSize || null,
        teacher: { id: String(row.teacherId), name: names.get(String(row.teacherId)) || "Teacher" },
        issueDate: row.issueDate?.toISOString?.() || null, expiryDate: expiry?.toISOString() || null,
        expiryStatus, createdAt: row.createdAt?.toISOString?.() || null,
        canPreview: false, canDownload: false,
      };
    }),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
