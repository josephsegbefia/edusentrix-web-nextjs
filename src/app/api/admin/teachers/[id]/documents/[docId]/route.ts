// src/app/api/admin/teachers/[id]/documents/[docId]/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherDocument } from "@/models/TeacherDocument";
import { logTeacherActivity } from "@/lib/teachers/logTeacherActivity";
import { deleteUploadedFile } from "@/lib/uploads/delete";
import mongoose from "mongoose";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/teachers/:id/documents/:docId
 * Get document details (for download - redirect to fileUrl)
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; docId: string }> }
) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  const { id, docId } = await ctx.params;
  const teacherObjId = toObjectIdOrNull(String(id));
  const docObjId = toObjectIdOrNull(String(docId));

  if (!teacherObjId || !docObjId) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  // Find document
  const document = await TeacherDocument.findOne({
    _id: docObjId,
    teacherId: teacherObjId,
    schoolId: schoolIdObj,
  });

  if (!document) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  // Return document details with fileUrl for download
  return Response.json({
    success: true,
    data: {
      id: String(document._id),
      name: document.name,
      type: document.type,
      fileUrl: document.fileUrl,
      fileMime: document.fileMime || null,
      fileSize: document.fileSize || null,
    },
  });
}

/**
 * DELETE /api/admin/teachers/:id/documents/:docId
 * Delete a document (delete uploaded file and remove record)
 */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; docId: string }> }
) {
  const { schoolId, userId: adminUserId } = await requireSchoolAdmin();
  await connectToDatabase();

  const { id, docId } = await ctx.params;
  const teacherObjId = toObjectIdOrNull(String(id));
  const docObjId = toObjectIdOrNull(String(docId));

  if (!teacherObjId || !docObjId) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  // Find document
  const document = await TeacherDocument.findOne({
    _id: docObjId,
    teacherId: teacherObjId,
    schoolId: schoolIdObj,
  });

  if (!document) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  const documentName = document.name;
  const fileUrl = document.fileUrl;

  // Try to delete file from whichever provider hosts it.
  // Continue even if provider deletion fails so the DB record can still be removed.
  if (fileUrl) {
    const deleted = await deleteUploadedFile(fileUrl);
    if (!deleted) {
      console.warn("Failed to delete document file from provider:", fileUrl);
    }
  }

  // Delete document record
  await TeacherDocument.findByIdAndDelete(docObjId);

  // Log activity
  await logTeacherActivity({
    teacherId: String(teacherObjId),
    schoolId: schoolIdObj,
    type: "document.deleted",
    title: "Document deleted",
    description: `Deleted document: ${documentName}`,
    metadata: {
      documentId: String(docObjId),
      documentName,
      deletedBy: adminUserId,
    },
    createdBy: adminUserId,
  });

  return Response.json({
    success: true,
    message: "Document deleted successfully",
    data: { id: String(docObjId) },
  });
}
