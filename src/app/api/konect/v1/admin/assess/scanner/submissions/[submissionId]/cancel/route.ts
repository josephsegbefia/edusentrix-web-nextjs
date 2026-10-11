import { NextResponse } from "next/server";
import {
  cancelSubmission,
  ownSubmission,
  scannerContext,
  serializeSubmission,
} from "@/lib/konect/script-submission-service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  const ctx = await scannerContext();
  const { submissionId } = await params;
  const row = await ownSubmission(submissionId, ctx.schoolId);
  const cancelled = await cancelSubmission({ submission: row, userId: ctx.userId });
  return NextResponse.json({ success: true, data: serializeSubmission(cancelled) });
}
