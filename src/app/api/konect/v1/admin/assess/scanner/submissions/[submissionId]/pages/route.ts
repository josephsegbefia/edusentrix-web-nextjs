import { NextResponse } from "next/server";
import { z } from "zod";
import { scannerContext, ownSubmission, initializePage } from "@/lib/konect/script-submission-service";

const schema = z.object({ fileName: z.string().trim().min(1).max(180), mimeType: z.string().trim().min(1), pageNumber: z.number().int().min(1).max(40) });

export async function POST(req: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  const ctx = await scannerContext();
  const { submissionId } = await params;
  const row = await ownSubmission(submissionId, ctx.schoolId);
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ success: false, error: "Invalid page request." }, { status: 400 });
  const data = await initializePage({ submission: row, userId: ctx.userId, ...body.data });
  return NextResponse.json({ success: true, data }, { status: 201 });
}
