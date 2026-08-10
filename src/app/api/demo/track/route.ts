import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { isDemoMode } from "@/lib/demo/runtime";
import {
  resolveDemoSessionFromCookie,
  touchDemoSessionInteraction,
} from "@/lib/demo/session";
import { trackDemoEvent, DEMO_EVENT_CODES } from "@/lib/demo/telemetry";

export const runtime = "nodejs";

const TrackSchema = z.object({
  eventCode: z.string().trim().max(120).optional(),
  eventType: z.string().trim().max(80).optional(),
  path: z.string().trim().max(500).optional(),
  title: z.string().trim().max(180).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  if (!isDemoMode()) {
    return NextResponse.json(
      { success: false, error: "Demo mode is not enabled." },
      { status: 404 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = TrackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message || "Invalid event." },
      { status: 400 }
    );
  }

  await connectToDatabase();
  const session = await resolveDemoSessionFromCookie({
    touch: false,
    enforceIdleTimeout: true,
  });
  if (!session) {
    return NextResponse.json(
      { success: false, error: "No active demo session." },
      { status: 401 }
    );
  }

  await touchDemoSessionInteraction(session._id);
  await trackDemoEvent({
    leadId: session.leadId,
    sessionId: session._id,
    sandboxId: session.sandboxId,
    schoolId: session.sandboxSchoolId,
    actorRole: session.activePersonaRole,
    actorUserId: session.activePersonaUserId,
    eventType: parsed.data.eventType || "page",
    eventCode: parsed.data.eventCode || DEMO_EVENT_CODES.PAGE_VIEWED,
    metadata: {
      ...parsed.data.metadata,
      path: parsed.data.path || null,
      title: parsed.data.title || null,
    },
  });

  return NextResponse.json({ success: true });
}
