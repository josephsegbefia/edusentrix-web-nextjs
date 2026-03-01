// src/app/api/admin/teachers/documents/expiring/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherDocument } from "@/models/TeacherDocument";
import mongoose from "mongoose";

/**
 * GET /api/admin/teachers/documents/expiring
 * Get expiring documents for all teachers in the school
 * Query params: daysAhead (default 30)
 */
export async function GET(req: NextRequest) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  const { searchParams } = new URL(req.url);
  const daysAhead = Math.max(1, parseInt(searchParams.get("daysAhead") || "30", 10));
  const includeExpired = searchParams.get("includeExpired") === "true";

  const now = new Date();
  const futureDate = new Date(now);
  futureDate.setDate(futureDate.getDate() + daysAhead);

  // Build query: expiring within window, optionally include already expired
  const expiryQuery: Record<string, unknown> = includeExpired
    ? { expiryDate: { $lte: futureDate } } // expired or expiring soon
    : { expiryDate: { $gte: now, $lte: futureDate } }; // expiring soon only

  const documents = await TeacherDocument.find({
    schoolId: schoolIdObj,
    expiryDate: { $exists: true, $ne: null },
    ...expiryQuery,
  })
    .populate("teacherId", "userId")
    .populate({
      path: "teacherId",
      populate: { path: "userId", select: "firstName lastName email" },
    })
    .populate("createdBy", "firstName lastName email")
    .sort({ expiryDate: 1 }) // Expiring soonest first
    .lean();

  const data = documents.map((doc: any) => {
    const teacher = doc.teacherId;
    const user = teacher?.userId;
    const expiryDate = new Date(doc.expiryDate);

    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      id: String(doc._id),
      name: String(doc.name),
      type: doc.type,
      category: doc.category || null,
      fileUrl: String(doc.fileUrl),
      expiryDate: expiryDate.toISOString(),
      daysUntilExpiry,
      expiryStatus: daysUntilExpiry < 0 ? "expired" : daysUntilExpiry <= 30 ? "expiring_soon" : "valid",
      teacher: user
        ? {
            id: String(teacher._id),
            name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
            email: user.email || null,
          }
        : null,
      createdAt: new Date(doc.createdAt).toISOString(),
    };
  });

  return Response.json({
    success: true,
    data,
    meta: {
      daysAhead,
      includeExpired,
      count: data.length,
    },
  });
}
