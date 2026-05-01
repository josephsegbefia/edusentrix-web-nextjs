import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { SchemeOfWork } from "@/models/SchemeOfWork";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid scheme id" }, { status: 400 });
    }

    const scheme = await SchemeOfWork.findOne({ _id: id, schoolId: ctx.schoolId });
    if (!scheme) return Response.json({ success: false, error: "Scheme not found" }, { status: 404 });
    scheme.status = "archived";
    scheme.archivedAt = new Date();
    scheme.updatedByUserId = ctx.userId;
    await scheme.save();
    return Response.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to archive scheme" },
      { status: 500 }
    );
  }
}
