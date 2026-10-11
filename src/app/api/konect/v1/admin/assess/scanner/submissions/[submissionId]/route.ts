import { NextResponse } from "next/server";
import { scannerContext, ownSubmission, serializeSubmission } from "@/lib/konect/script-submission-service";

export async function GET(_req: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  const ctx = await scannerContext();
  const { submissionId } = await params;
  const row = await ownSubmission(submissionId, ctx.schoolId, ctx.userId);
  return NextResponse.json({ success: true, data: serializeSubmission(row) });
}
