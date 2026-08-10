import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { isDemoMode } from "@/lib/demo/runtime";

export const runtime = "nodejs";

const RequestAccessSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required"),
  email: z.string().trim().email("A valid email is required").toLowerCase(),
  phone: z.string().trim().min(5, "Phone number is required"),
  schoolName: z.string().trim().min(2, "School name is required"),
  schoolAddress: z.string().trim().optional(),
  city: z.string().trim().optional(),
  region: z.string().trim().optional(),
  source: z.string().trim().optional(),
  utm: z.record(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    if (!isDemoMode()) {
      return NextResponse.json(
        { success: false, error: "Demo mode is not enabled." },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = RequestAccessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || "Invalid request",
        },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const [{ DemoSession }, { DemoSandbox }, { createOrReuseDemoAccess }] = await Promise.all([
      import("@/models/DemoSession"),
      import("@/models/DemoSandbox"),
      import("@/lib/demo/leads"),
    ]);

    const activeSessions = await DemoSession.countDocuments({ status: "active" });
    const maxSessions = Number(process.env.DEMO_MAX_ACTIVE_SESSIONS || 50);
    if (activeSessions >= maxSessions) {
      return NextResponse.json(
        {
          success: false,
          error:
            "All demo slots are currently in use. Please try again shortly.",
          reason: "capacity_blocked",
        },
        { status: 503 }
      );
    }

    const availableSandboxes = await DemoSandbox.countDocuments({
      state: { $in: ["available", "allocated"] },
    });
    if (availableSandboxes <= 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The demo pool has not been provisioned yet. Seed the flagship demo sandboxes before opening new sessions.",
          reason: "capacity_blocked",
        },
        { status: 503 }
      );
    }

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const userAgent = req.headers.get("user-agent") || null;

    const result = await createOrReuseDemoAccess({
      ...parsed.data,
      ipAddress: ipAddress ?? undefined,
      userAgent: userAgent ?? undefined,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.message, reason: result.reason },
        { status: result.reason === "capacity_blocked" ? 503 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        redirectTo: result.redirectTo,
        sessionId: String(result.session._id),
        expiresAt: result.session.expiresAt,
      },
    });
  } catch (error) {
    console.error("[demo/request-access:POST]", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to start demo session.",
      },
      { status: 500 }
    );
  }
}
