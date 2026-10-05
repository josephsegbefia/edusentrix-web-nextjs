import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { writeBackgroundJobAudit } from "@/lib/background/audit";
import { canCancelBackgroundJob } from "@/lib/background/authorization";
import { toSafeBackgroundJobDTO } from "@/lib/background/serializers";
import { requestJobCancellation } from "@/lib/background/state-machine";
import { BackgroundJob } from "@/models/BackgroundJob";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const gate = await requirePlatformPermission("platform.system.settings.read");
    if (!gate.ok) return gate.res;

    const { jobId } = await context.params;
    if (!Types.ObjectId.isValid(jobId)) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    await connectToDatabase();
    const job = await BackgroundJob.findById(jobId);
    if (!job) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const actor = { userId: gate.actor.userId, isPlatformOperator: true };
    const access = canCancelBackgroundJob(actor, job);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.reason }, { status: 400 });
    }

    const updated = (await requestJobCancellation(job._id, actor.userId)) ?? job;
    await writeBackgroundJobAudit({
      actionCode: "background.job.cancel_requested",
      actor,
      job: updated,
    });
    return NextResponse.json({ success: true, data: toSafeBackgroundJobDTO(updated, actor) });
  } catch (error) {
    console.error("Failed to cancel background job:", error);
    return NextResponse.json(
      { success: false, error: "Failed to cancel background job" },
      { status: 500 }
    );
  }
}
