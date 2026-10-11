import { NextResponse } from "next/server";
import { z } from "zod";
import { ScriptSubmission } from "@/models/ScriptSubmission";
import { scannerContext, createSubmission, serializeSubmission } from "@/lib/konect/script-submission-service";

const createSchema = z.object({ examPaperId: z.string().trim().min(1), studentId: z.string().trim().min(1), idempotencyKey: z.string().trim().min(16).max(160) });

export async function GET() {
  const ctx = await scannerContext();
  const rows = await ScriptSubmission.find({ schoolId: ctx.schoolId, submittedByUserId: ctx.userId }).sort({ createdAt: -1 }).limit(100).lean();
  return NextResponse.json({ success: true, data: rows.map(serializeSubmission) });
}

export async function POST(req: Request) {
  const ctx = await scannerContext();
  const body = createSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ success: false, error: "Invalid submission request." }, { status: 400 });
  const result = await createSubmission({ schoolId: ctx.schoolId, userId: ctx.userId, ...body.data });
  return NextResponse.json({ success: true, data: serializeSubmission(result.submission), created: result.created }, { status: result.created ? 201 : 200 });
}
