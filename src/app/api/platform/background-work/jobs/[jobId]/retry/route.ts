import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { retryBackgroundJob } from "@/lib/background/retry-job";
import { toSafeBackgroundJobDTO } from "@/lib/background/serializers";
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
    const result = await retryBackgroundJob({
      sourceJobId: jobId,
      actor: { userId: gate.actor.userId, isPlatformOperator: true },
      operatorEmailRetry: true,
    });
    if (!result.ok) {
      const status =
        result.reason === "not_found" ? 404 : result.reason === "not_failed" ? 409 : 400;
      return NextResponse.json({ success: false, error: result.reason }, { status });
    }

    return NextResponse.json({
      success: true,
      data: toSafeBackgroundJobDTO(result.created.job, {
        userId: gate.actor.userId,
        isPlatformOperator: true,
      }),
    });
  } catch (error) {
    console.error("Failed to retry background job:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retry background job" },
      { status: 500 }
    );
  }
}
