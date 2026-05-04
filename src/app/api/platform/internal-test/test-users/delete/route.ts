import mongoose from "mongoose";
import { z } from "zod";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformInternalTestAccess } from "@/lib/auth/requirePlatformInternalTest";
import { PHRASE_DELETE_ALL_TEST_USERS } from "@/lib/internal-test/constants";
import { deleteTestUserById } from "@/lib/internal-test/delete-test-user";
import { isActivationSecretConfigured, isValidInternalTestActivationSecret } from "@/lib/internal-test/verify-activation-secret";
import { writePlatformAuditLog } from "@/lib/internal-test/write-audit";
import { User } from "@/models/User";

const BodySchema = z.object({
  confirmationPhrase: z.string().min(1),
  activationSecret: z.string().min(1),
  scope: z.enum(["all", "school", "ids"]),
  schoolId: z.string().optional(),
  userIds: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  try {
    const gate = await requirePlatformInternalTestAccess();
    if (!gate.ok) return gate.res;

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (parsed.data.confirmationPhrase.trim() !== PHRASE_DELETE_ALL_TEST_USERS) {
      return NextResponse.json(
        {
          success: false,
          error: `Confirmation phrase must be exactly: ${PHRASE_DELETE_ALL_TEST_USERS}`,
        },
        { status: 400 }
      );
    }

    if (!isActivationSecretConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: "INTERNAL_TEST_ACTIVATION_SECRET is not configured on the server.",
          code: "ACTIVATION_SECRET_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }

    if (!isValidInternalTestActivationSecret(parsed.data.activationSecret)) {
      return NextResponse.json(
        { success: false, error: "Invalid activation secret.", code: "INVALID_ACTIVATION_SECRET" },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const filter: Record<string, unknown> = { isTestUser: true };
    if (parsed.data.scope === "school") {
      const sid = parsed.data.schoolId?.trim();
      if (!sid || !mongoose.Types.ObjectId.isValid(sid)) {
        return NextResponse.json(
          { success: false, error: "schoolId is required for scope=school" },
          { status: 400 }
        );
      }
      filter.schoolId = new mongoose.Types.ObjectId(sid);
    } else if (parsed.data.scope === "ids") {
      const ids = parsed.data.userIds?.filter((id) => mongoose.Types.ObjectId.isValid(id)) ?? [];
      if (ids.length === 0) {
        return NextResponse.json(
          { success: false, error: "userIds must contain at least one valid id for scope=ids" },
          { status: 400 }
        );
      }
      filter._id = { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) };
    }

    const targets = await User.find(filter).select("_id").lean<{ _id: mongoose.Types.ObjectId }[]>();

    await writePlatformAuditLog({
      actorId: gate.me._id,
      schoolId:
        parsed.data.scope === "school" && parsed.data.schoolId && mongoose.Types.ObjectId.isValid(parsed.data.schoolId)
          ? new mongoose.Types.ObjectId(parsed.data.schoolId)
          : undefined,
      action: "internal_test.test_users_delete_started",
      entityType: "User",
      metadata: {
        scope: parsed.data.scope,
        count: targets.length,
      },
    });

    const results: Array<{ userId: string; ok: boolean; error?: string }> = [];
    for (const t of targets) {
      const r = await deleteTestUserById(t._id);
      results.push({
        userId: r.userId,
        ok: r.mongoDeleted && !r.error,
        error: r.error,
      });
    }

    const okCount = results.filter((r) => r.ok).length;

    await writePlatformAuditLog({
      actorId: gate.me._id,
      schoolId:
        parsed.data.scope === "school" && parsed.data.schoolId && mongoose.Types.ObjectId.isValid(parsed.data.schoolId)
          ? new mongoose.Types.ObjectId(parsed.data.schoolId)
          : undefined,
      action: "internal_test.test_users_delete_completed",
      entityType: "User",
      metadata: {
        scope: parsed.data.scope,
        attempted: targets.length,
        deleted: okCount,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        attempted: targets.length,
        deleted: okCount,
        results,
      },
    });
  } catch (e) {
    console.error("platform internal-test test-users delete POST", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Delete failed" },
      { status: 500 }
    );
  }
}
