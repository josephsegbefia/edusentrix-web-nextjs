import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { isDemoMode } from "@/lib/demo/runtime";
import {
  resolveDemoSessionFromCookie,
  touchDemoSessionInteraction,
} from "@/lib/demo/session";
import { DemoSession } from "@/models/DemoSession";
import { User } from "@/models/User";
import { trackDemoEvent, DEMO_EVENT_CODES } from "@/lib/demo/telemetry";

const ALLOWED_PERSONAS = [
  "school_admin",
  "teacher",
  "parent",
  "student",
  "bursar",
] as const;

const SwitchPersonaSchema = z.object({
  role: z.enum(ALLOWED_PERSONAS),
});

export async function POST(req: NextRequest) {
  if (!isDemoMode()) {
    return NextResponse.json(
      { success: false, error: "Demo mode is not enabled." },
      { status: 404 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = SwitchPersonaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid role",
      },
      { status: 400 }
    );
  }

  await connectToDatabase();

  const session = await resolveDemoSessionFromCookie();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "No active demo session." },
      { status: 401 }
    );
  }

  const targetRole = parsed.data.role;

  const personaUser = await User.findOne({
    schoolId: session.sandboxSchoolId,
    role: targetRole,
  })
    .select("_id role")
    .lean();

  if (!personaUser) {
    return NextResponse.json(
      {
        success: false,
        error: `No ${targetRole} persona available in this sandbox.`,
      },
      { status: 404 }
    );
  }

  await DemoSession.updateOne(
    { _id: session._id },
    {
      $set: {
        activePersonaRole: targetRole,
        activePersonaUserId: personaUser._id,
      },
    }
  );
  await touchDemoSessionInteraction(session._id);
  await trackDemoEvent({
    leadId: session.leadId,
    sessionId: session._id,
    sandboxId: session.sandboxId,
    schoolId: session.sandboxSchoolId,
    actorRole: targetRole,
    actorUserId: personaUser._id,
    eventType: "persona",
    eventCode: DEMO_EVENT_CODES.PERSONA_SWITCHED,
    metadata: { role: targetRole },
  });

  const redirectMap: Record<string, string> = {
    school_admin: "/admin",
    teacher: "/teacher",
    parent: "/parent",
    student: "/student",
    bursar: "/admin/settings/payment-setup",
  };

  return NextResponse.json({
    success: true,
    data: {
      role: targetRole,
      redirectTo: redirectMap[targetRole] || "/admin",
    },
  });
}
