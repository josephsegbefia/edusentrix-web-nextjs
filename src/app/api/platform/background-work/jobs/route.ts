import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  listOperatorBackgroundJobs,
  parseBackgroundJobListKind,
  parseOperatorJobStatus,
} from "@/lib/background/list-jobs";
import { staleHeartbeatThresholdMs } from "@/lib/background/stale-jobs";
import { toSafeBackgroundJobDTO } from "@/lib/background/serializers";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const gate = await requirePlatformPermission("platform.system.settings.read");
    if (!gate.ok) return gate.res;

    await connectToDatabase();
    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 1), 50);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);
    const kindParam = url.searchParams.get("kind");
    const kind = parseBackgroundJobListKind(kindParam);
    if (kindParam && !kind) {
      return NextResponse.json({ success: false, error: "Unknown job kind" }, { status: 400 });
    }
    const statusParam = url.searchParams.get("status");
    const status = parseOperatorJobStatus(statusParam);
    if (statusParam && !status) {
      return NextResponse.json({ success: false, error: "Unknown job status" }, { status: 400 });
    }
    const stale = url.searchParams.get("stale") === "1";

    const { jobs, total } = await listOperatorBackgroundJobs({
      kind,
      status,
      stale,
      staleBefore: stale ? new Date(Date.now() - staleHeartbeatThresholdMs()) : null,
      limit,
      offset,
    });

    const actor = {
      userId: gate.actor.userId,
      isPlatformOperator: true,
    };

    return NextResponse.json({
      success: true,
      data: {
        jobs: jobs.map((job) => toSafeBackgroundJobDTO(job, actor)),
        pagination: { total, limit, offset, hasMore: offset + limit < total },
      },
    });
  } catch (error) {
    console.error("Failed to list operator background jobs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list background jobs" },
      { status: 500 }
    );
  }
}
