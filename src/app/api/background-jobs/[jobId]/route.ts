import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { BackgroundJob } from "@/models/BackgroundJob";
import { decideBackgroundJobAccess } from "@/lib/background/authorization";
import { resolveBackgroundJobRouteActor } from "@/lib/background/route-auth";
import { toSafeBackgroundJobDTO } from "@/lib/background/serializers";

export const dynamic = "force-dynamic";

export async function GET(
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

    const access = decideBackgroundJobAccess(auth.actor, job);
    if (!access.ok) {
      const status = access.reason === "not_found" ? 404 : 403;
      return NextResponse.json(
        { success: false, error: access.reason === "not_found" ? "Not found" : "Forbidden" },
        { status }
      );
    }

    return NextResponse.json({ success: true, data: toSafeBackgroundJobDTO(job) });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to load background job:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load background job" },
      { status: 500 }
    );
  }
}
