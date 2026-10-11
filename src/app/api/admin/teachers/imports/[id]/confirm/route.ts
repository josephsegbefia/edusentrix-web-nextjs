import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { enqueueTeacherImportCommit, serializeTeacherImportJob } from "@/lib/teachers/teacher-import-workflow";
import { assertTeacherImportId } from "@/lib/teachers/teacher-import-route";

const BodySchema = z.object({ invitationMode: z.enum(["send_now", "create_only"]).default("send_now") });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSchoolAdmin();
    await connectToDatabase();
    const { id } = await ctx.params;
    const objectId = assertTeacherImportId(id);
    if (!objectId) return Response.json({ success: false, error: "Invalid teacher import id" }, { status: 400 });
    const body = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) return Response.json({ success: false, error: "Invalid invitation mode" }, { status: 400 });
    const queued = await enqueueTeacherImportCommit({
      schoolId: actor.schoolId,
      teacherImportJobId: objectId,
      approvedByUserId: actor.userId,
      invitationMode: body.data.invitationMode,
    });
    return Response.json({ success: true, jobId: queued.jobId, data: { job: serializeTeacherImportJob(queued.job) } }, { status: 202 });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to confirm teacher import" }, { status: 400 });
  }
}
