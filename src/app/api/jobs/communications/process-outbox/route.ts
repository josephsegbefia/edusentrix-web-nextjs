import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { processCommunicationOutbox } from "@/lib/communications/delivery/processOutboxJobs";

const ProcessSchema = z.object({
  schoolId: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), "Invalid school id").optional(),
  communicationId: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), "Invalid communication id").optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

function hasCronSecret(req: NextRequest) {
  const expected = process.env.COMMUNICATIONS_JOB_SECRET;
  if (!expected) return false;
  return req.headers.get("x-job-secret") === expected;
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json().catch(() => ({}));
    const parsed = ProcessSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ success: false, error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    if (!hasCronSecret(req)) {
      await requireSchoolAdminOrDelegatedAnyPermission(["communications.send"]);
    }

    const result = await processCommunicationOutbox({
      schoolId: parsed.data.schoolId ? new mongoose.Types.ObjectId(parsed.data.schoolId) : undefined,
      communicationId: parsed.data.communicationId ? new mongoose.Types.ObjectId(parsed.data.communicationId) : undefined,
      limit: parsed.data.limit,
    });
    return Response.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to process communication outbox" }, { status: 500 });
  }
}
