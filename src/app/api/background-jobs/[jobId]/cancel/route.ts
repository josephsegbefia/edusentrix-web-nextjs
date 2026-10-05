import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { BackgroundJob } from "@/models/BackgroundJob";
import { canCancelBackgroundJob } from "@/lib/background/authorization";
import { resolveBackgroundJobRouteActor } from "@/lib/background/route-auth";
import { toSafeBackgroundJobDTO } from "@/lib/background/serializers";
import { requestJobCancellation } from "@/lib/background/state-machine";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    if (!Types.ObjectId.isValid(jobId)) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    await connectToDatabase();
    const auth = await resolveBackgroundJobRouteActor();
    if (!auth.ok) return auth.res;

    const job = await BackgroundJob.findById(jobId);
    if (!job) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const access = canCancelBackgroundJob(auth.actor, job);
    if (!access.ok) {
      if (access.reason === "not_found") {
        return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
      }
      if (access.reason === "not_cancellable") {
        return NextResponse.json(
          { success: false, error: "This job cannot be cancelled" },
          { status: 400 }
        );
      }
      if (access.reason === "terminal") {
        return NextResponse.json(
          { success: false, error: "Job is already finished" },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const updated = (await requestJobCancellation(job._id, auth.actor.userId)) ?? job;
    return NextResponse.json({ success: true, data: toSafeBackgroundJobDTO(updated) });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to cancel background job:", error);
    return NextResponse.json(
      { success: false, error: "Failed to cancel background job" },
      { status: 500 }
    );
  }
}
