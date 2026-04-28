// src/app/api/admin/documents/teachers/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherDocument } from "@/models/TeacherDocument";
import mongoose from "mongoose";

const DOCUMENT_TYPES = [
  "contract",
  "certificate",
  "license",
  "id",
  "resume",
  "other",
] as const;

/**
 * GET /api/admin/documents/teachers
 * Get all teacher documents for the school (school-wide overview)
 * Query params: type, teacherId, page, limit, sortBy (expiryDate|createdAt), sortOrder (asc|desc)
 */
export async function GET(req: NextRequest) {
  const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("documents");
  await connectToDatabase();

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const teacherId = searchParams.get("teacherId");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const sortBy = searchParams.get("sortBy") || "expiryDate";
  const sortOrder: 1 | -1 = searchParams.get("sortOrder") === "desc" ? -1 : 1;

  const query: Record<string, unknown> = { schoolId: schoolIdObj };

  if (type && DOCUMENT_TYPES.includes(type as (typeof DOCUMENT_TYPES)[number])) {
    query.type = type;
  }
  if (teacherId) {
    try {
      query.teacherId = new mongoose.Types.ObjectId(teacherId);
    } catch {
      return Response.json({ error: "Invalid teacher ID" }, { status: 400 });
    }
  }

  const total = await TeacherDocument.countDocuments(query);

  const sortField: Record<string, mongoose.SortOrder> =
    sortBy === "createdAt"
      ? { createdAt: sortOrder }
      : { expiryDate: sortOrder, createdAt: -1 };

  const documents = await TeacherDocument.find(query)
    .populate("teacherId", "userId")
    .populate({
      path: "teacherId",
      populate: { path: "userId", select: "firstName lastName email" },
    })
    .populate("createdBy", "firstName lastName email")
    .sort(sortField)
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const now = new Date();
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const data = documents.map((doc: Record<string, unknown>) => {
    const teacher = doc.teacherId as { _id: unknown; userId?: { firstName?: string; lastName?: string; email?: string } } | null;
    const user = teacher?.userId;
    const expiryDate = doc.expiryDate ? new Date(doc.expiryDate as string) : null;
    let expiryStatus: "expired" | "expiring_soon" | "valid" | null = null;
    if (expiryDate) {
      if (expiryDate < now) expiryStatus = "expired";
      else if (expiryDate <= thirtyDaysFromNow) expiryStatus = "expiring_soon";
      else expiryStatus = "valid";
    }

    return {
      id: String(doc._id),
      name: String(doc.name),
      type: doc.type,
      category: (doc.category as string) || null,
      fileUrl: String(doc.fileUrl),
      expiryDate: expiryDate?.toISOString() ?? null,
      expiryStatus,
      teacher: teacher
        ? {
            id: String(teacher._id),
            name: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "Unknown",
            email: user?.email ?? null,
          }
        : null,
      createdAt: new Date(doc.createdAt as string).toISOString(),
    };
  });

  return Response.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
