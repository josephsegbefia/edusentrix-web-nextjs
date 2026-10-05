import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { BulkImportJob } from "@/models/BulkImportJob";
import { serializeBulkImportJob } from "@/lib/imports/enqueue-bulk-import";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "students.edit",
    ]);
    await connectToDatabase();
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }
    const job = await BulkImportJob.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId,
    });
    if (!job) {
      return NextResponse.json({ success: false, error: "Import job not found" }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      data: serializeBulkImportJob(job),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load import" },
      { status: 500 }
    );
  }
}
