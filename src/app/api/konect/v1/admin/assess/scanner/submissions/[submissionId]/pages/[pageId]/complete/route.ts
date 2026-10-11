import { NextResponse } from "next/server";
import { z } from "zod";
import { scannerContext, ownSubmission, completePage } from "@/lib/konect/script-submission-service";

const schema = z.object({ assetId: z.string().trim().min(1) });

export async function POST(req: Request, { params }: { params: Promise<{ submissionId: string; pageId: string }> }) {
  const ctx = await scannerContext();
  const { submissionId, pageId } = await params;
  const row = await ownSubmission(submissionId, ctx.schoolId);
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ success: false, error: "assetId is required." }, { status: 400 });
  const data = await completePage({ submission: row, pageId, assetId: body.data.assetId, actor: ctx.actor });
  return NextResponse.json({ success: true, data });
}
