import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getParentWardIds, requireParent } from "@/lib/auth/requireParent";
import { Student } from "@/models/Student";

export async function GET() {
  try {
    const ctx = await requireParent();
    await connectToDatabase();
    const wardIds = await getParentWardIds(ctx.userId);
    const students = await Student.find({ _id: { $in: wardIds }, schoolId: ctx.schoolId, status: "active" })
      .select("_id firstName lastName parentDocumentRequests recordDocuments")
      .lean();
    const requests = students.flatMap((student) =>
      (student.parentDocumentRequests ?? []).map((request) => {
        const fulfilled = Boolean(request.fulfilledAt);
        const matchingDocument = (student.recordDocuments ?? [])
          .slice()
          .reverse()
          .find((document) => document.type === "parent_request" && document.name?.includes(request.label));
        return {
          id: String(request._id),
          documentType: "parent_request",
          label: request.label,
          description: request.message || null,
          wardId: String(student._id),
          wardName: `${student.firstName} ${student.lastName}`,
          status: fulfilled ? "uploaded" : "pending",
          uploadedAt: request.fulfilledAt?.toISOString?.() || null,
          rejectionReason: null,
          fileUrl: matchingDocument?.fileUrl || null,
        };
      })
    );
    return NextResponse.json({ success: true, data: { requests } });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Failed to load documents";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
