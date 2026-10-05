import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { resolveBackgroundJobRouteActor } from "@/lib/background/route-auth";
import { retryBackgroundJob } from "@/lib/background/retry-job";
import { toSafeBackgroundJobDTO } from "@/lib/background/serializers";

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

    const result = await retryBackgroundJob({ sourceJobId: jobId, actor: auth.actor });
    if (!result.ok) {
      const status =
        result.reason === "not_found"
          ? 404
          : result.reason === "forbidden"
            ? 403
            : result.reason === "not_failed"
              ? 409
              : 400;
      return NextResponse.json({ success: false, error: result.reason }, { status });
    }

    return NextResponse.json({
      success: true,
      data: toSafeBackgroundJobDTO(result.created.job, auth.actor),
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to retry background job:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retry background job" },
      { status: 500 }
    );
  }
}
