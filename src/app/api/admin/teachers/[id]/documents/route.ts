// src/app/api/admin/teachers/[id]/documents/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherDocument } from "@/models/TeacherDocument";
import { logTeacherActivity } from "@/lib/teachers/logTeacherActivity";
import mongoose from "mongoose";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/teachers/:id/documents
 * Get documents for a teacher
 * Query params: type, category, page, limit
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  const { id } = await ctx.params;
  const teacherObjId = toObjectIdOrNull(String(id));

  if (!teacherObjId) {
    return Response.json({ error: "Invalid teacher id" }, { status: 400 });
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as
    | "contract"
    | "certificate"
    | "license"
    | "id"
    | "resume"
    | "other"
    | null;
  const category = searchParams.get("category");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));

  // Build query
  const query: Record<string, unknown> = {
    teacherId: teacherObjId,
    schoolId: schoolIdObj,
  };

  if (type) {
    query.type = type;
  }
  if (category) {
    query.category = category;
  }

  // Get total count
  const total = await TeacherDocument.countDocuments(query);

  // Get documents - sort by expiryDate (expiring first), then by createdAt (newest first)
  const documents = await TeacherDocument.find(query)
    .populate("createdBy", "firstName lastName email")
    .sort({ expiryDate: 1, createdAt: -1 }) // Expiring first, then newest
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const now = new Date();
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const data = documents.map((doc: any) => {
    const expiryDate = doc.expiryDate ? new Date(doc.expiryDate) : null;
    let expiryStatus: "expired" | "expiring_soon" | "valid" | null = null;
    if (expiryDate) {
      if (expiryDate < now) {
        expiryStatus = "expired";
      } else if (expiryDate <= thirtyDaysFromNow) {
        expiryStatus = "expiring_soon";
      } else {
        expiryStatus = "valid";
      }
    }

    return {
      id: String(doc._id),
      name: String(doc.name),
      type: doc.type,
      category: doc.category || null,
      fileUrl: String(doc.fileUrl),
      fileMime: doc.fileMime || null,
      fileSize: doc.fileSize || null,
      tags: Array.isArray(doc.tags) ? doc.tags : [],
      notes: doc.notes || null,
      issueDate: doc.issueDate ? new Date(doc.issueDate).toISOString() : null,
      expiryDate: expiryDate ? expiryDate.toISOString() : null,
      expiryStatus,
      createdBy: doc.createdBy
        ? {
            id: String(doc.createdBy._id),
            name: `${doc.createdBy.firstName || ""} ${doc.createdBy.lastName || ""}`.trim(),
            email: doc.createdBy.email || null,
          }
        : null,
      createdAt: new Date(doc.createdAt).toISOString(),
      updatedAt: new Date(doc.updatedAt).toISOString(),
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

/**
 * POST /api/admin/teachers/:id/documents
 * Upload/create a document record
 * Body: { name, type, category, fileUrl, fileMime, fileSize, tags, notes, issueDate, expiryDate }
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId, userId: adminUserId } = await requireSchoolAdmin();
  await connectToDatabase();

  const { id } = await ctx.params;
  const teacherObjId = toObjectIdOrNull(String(id));

  if (!teacherObjId) {
    return Response.json({ error: "Invalid teacher id" }, { status: 400 });
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  // Parse body
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    name,
    type,
    category,
    fileUrl,
    fileMime,
    fileSize,
    tags,
    notes,
    issueDate,
    expiryDate,
  } = body;

  // Validate required fields
  if (!name || !type || !fileUrl) {
    return Response.json(
      { error: "name, type, and fileUrl are required" },
      { status: 400 }
    );
  }

  const validTypes = ["contract", "certificate", "license", "id", "resume", "other"];
  if (!validTypes.includes(type)) {
    return Response.json(
      { error: `type must be one of: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  // Create document
  const document = await TeacherDocument.create({
    teacherId: teacherObjId,
    schoolId: schoolIdObj,
    name: String(name),
    type,
    category: category || undefined,
    fileUrl: String(fileUrl),
    fileMime: fileMime || undefined,
    fileSize: fileSize ? Number(fileSize) : undefined,
    tags: Array.isArray(tags) ? tags : [],
    notes: notes || undefined,
    issueDate: issueDate ? new Date(issueDate) : undefined,
    expiryDate: expiryDate ? new Date(expiryDate) : undefined,
    createdBy: adminUserId ? new mongoose.Types.ObjectId(String(adminUserId)) : undefined,
  });

  // Log activity
  await logTeacherActivity({
    teacherId: String(teacherObjId),
    schoolId: schoolIdObj,
    type: "document.added",
    title: "Document uploaded",
    description: `Uploaded document: ${name} (${type})`,
    metadata: {
      documentId: String(document._id),
      name,
      type,
      uploadedBy: adminUserId,
    },
    createdBy: adminUserId,
  });

  return Response.json({
    success: true,
    message: "Document uploaded successfully",
    data: {
      id: String(document._id),
      name: document.name,
      type: document.type,
    },
  });
}
