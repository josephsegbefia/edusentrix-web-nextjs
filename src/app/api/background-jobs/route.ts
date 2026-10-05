import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  parseBackgroundJobListFilter,
  parseBackgroundJobListKind,
  listCurrentUserBackgroundJobs,
} from "@/lib/background/list-jobs";
import { resolveBackgroundJobRouteActor } from "@/lib/background/route-auth";
import { toSafeBackgroundJobDTO } from "@/lib/background/serializers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const auth = await resolveBackgroundJobRouteActor();
    if (!auth.ok) return auth.res;

    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 1), 50);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);
    const filter = parseBackgroundJobListFilter(url.searchParams.get("filter"));
    const kindParam = url.searchParams.get("kind");
    const kind = parseBackgroundJobListKind(kindParam);
    if (kindParam && !kind) {
      return NextResponse.json({ success: false, error: "Unknown job kind" }, { status: 400 });
    }

    const { jobs, total } = await listCurrentUserBackgroundJobs({
      actor: auth.actor,
      filter,
      kind,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: {
        jobs: jobs.map(toSafeBackgroundJobDTO),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to list background jobs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list background jobs" },
      { status: 500 }
    );
  }
}
