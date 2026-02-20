// src/app/api/admin/teachers/[id]/documents/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherDocument } from "@/models/TeacherDocument";
import { logTeacherActivity } from "@/lib/teachers/logTeacherActivity";
import { deleteUploadedFile } from "@/lib/uploads/delete";
import mongoose from "mongoose";

type TeacherDocumentListItem = {
  _id: unknown;
  name?: string;
  type:
    | "contract"
    | "certificate"
    | "license"
    | "id"
    | "resume"
    | "other";
  category?: string | null;
  fileUrl?: string;
  fileMime?: string | null;
  fileSize?: number | null;
  tags?: string[];
  notes?: string | null;
  issueDate?: Date | string | null;
  expiryDate?: Date | string | null;
  createdBy?:
    | {
        _id?: unknown;
        firstName?: string;
        lastName?: string;
        email?: string | null;
      }
    | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

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

  const data = documents.map((doc) => {
    const item = doc as TeacherDocumentListItem;
    const expiryDate = item.expiryDate ? new Date(item.expiryDate) : null;
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
      name: String(item.name || ""),
      type: item.type,
      category: item.category || null,
      fileUrl: String(item.fileUrl || ""),
      fileMime: item.fileMime || null,
      fileSize: item.fileSize || null,
      tags: Array.isArray(item.tags) ? item.tags : [],
      notes: item.notes || null,
      issueDate: item.issueDate ? new Date(item.issueDate).toISOString() : null,
      expiryDate: expiryDate ? expiryDate.toISOString() : null,
      expiryStatus,
      createdBy: item.createdBy
        ? {
            id: String(item.createdBy._id),
            name: `${item.createdBy.firstName || ""} ${item.createdBy.lastName || ""}`.trim(),
            email: item.createdBy.email || null,
          }
        : null,
      createdAt: new Date(item.createdAt || now).toISOString(),
      updatedAt: new Date(item.updatedAt || now).toISOString(),
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

  const normalizedFileUrl = String(fileUrl);
  let document:
    | {
        _id: mongoose.Types.ObjectId;
        name: string;
        type: string;
      }
    | undefined;

  try {
    document = await TeacherDocument.create({
      teacherId: teacherObjId,
      schoolId: schoolIdObj,
      name: String(name),
      type,
      category: category || undefined,
      fileUrl: normalizedFileUrl,
      fileMime: fileMime || undefined,
      fileSize: fileSize ? Number(fileSize) : undefined,
      tags: Array.isArray(tags) ? tags : [],
      notes: notes || undefined,
      issueDate: issueDate ? new Date(issueDate) : undefined,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      createdBy: adminUserId
        ? new mongoose.Types.ObjectId(String(adminUserId))
        : undefined,
    });

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
  } catch (error) {
    // Roll back uploaded file if DB/create path fails.
    const deleted = await deleteUploadedFile(normalizedFileUrl);
    if (!deleted) {
      console.error("Rollback failed for uploaded document:", normalizedFileUrl);
    }
    console.error("Document creation failed:", error);
    return Response.json({ error: "Failed to create document record" }, { status: 500 });
  }

  if (!document) {
    return Response.json({ error: "Failed to create document record" }, { status: 500 });
  }

  return Response.json({
    success: true,
    message: "Document uploaded successfully",
    data: {
      id: String(document._id),
      name: document.name,
      type: document.type as
        | "contract"
        | "certificate"
        | "license"
        | "id"
        | "resume"
        | "other",
    },
  });
}
