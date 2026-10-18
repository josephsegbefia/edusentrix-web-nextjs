import "server-only";

import mongoose, { type Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { buildPlatformSchoolAuditContext, resolveAuditIdempotencyKey } from "@/lib/audit/fromApiRoute";
import { writeTransactionalAuditEvent } from "@/lib/audit/writeTransactionalAuditEvent";
import { getSchoolSetupProgress, type SchoolSetupProgress } from "@/lib/platform/schools/setup-progress";
import { School } from "@/models/School";

export type SchoolActiveTransitionKind = "activation" | "reactivation";

export type SchoolActiveTransitionActor = {
  userId: Types.ObjectId;
  email: string;
};

export class SchoolActiveTransitionError extends Error {
  constructor(
    public readonly code: "SCHOOL_NOT_FOUND" | "INVALID_LIFECYCLE_STATE" | "ACTIVATION_CONFLICT",
    public readonly currentStatus?: string,
  ) {
    super(code);
  }
}

export type SchoolActiveTransitionResult = {
  schoolId: string;
  status: "active";
  previousStatus: "pending" | "deactivated" | "active";
  transitioned: boolean;
  setupProgress: SchoolSetupProgress;
};

export async function transitionSchoolToActive(input: {
  req: Request;
  schoolId: Types.ObjectId;
  actor: SchoolActiveTransitionActor;
  reason: string;
  kind: SchoolActiveTransitionKind;
}): Promise<SchoolActiveTransitionResult> {
  const expectedStatus = input.kind === "activation" ? "pending" : "deactivated";
  const actionCode =
    input.kind === "activation"
      ? "school.lifecycle.activated"
      : "school.lifecycle.reactivated";

  await connectToDatabase();
  const setupProgress = await getSchoolSetupProgress(input.schoolId);
  const session = await mongoose.startSession();
  let result: SchoolActiveTransitionResult | null = null;

  try {
    await session.withTransaction(async () => {
      const school = await School.findById(input.schoolId)
        .session(session)
        .select("_id status")
        .lean<{ _id: Types.ObjectId; status: "pending" | "active" | "deactivated" } | null>();

      if (!school) {
        throw new SchoolActiveTransitionError("SCHOOL_NOT_FOUND");
      }

      if (school.status === "active") {
        result = {
          schoolId: String(school._id),
          status: "active",
          previousStatus: "active",
          transitioned: false,
          setupProgress,
        };
        return;
      }

      if (school.status !== expectedStatus) {
        throw new SchoolActiveTransitionError(
          "INVALID_LIFECYCLE_STATE",
          school.status,
        );
      }

      const updated = await School.findOneAndUpdate(
        { _id: input.schoolId, status: expectedStatus },
        { $set: { status: "active" } },
        { new: true, session, runValidators: true },
      )
        .select("_id status")
        .lean<{ _id: Types.ObjectId; status: "active" } | null>();

      if (!updated) {
        throw new SchoolActiveTransitionError("ACTIVATION_CONFLICT");
      }

      await writeTransactionalAuditEvent(session, {
        actionCode,
        scopeType: "school",
        scopeId: String(input.schoolId),
        result: "succeeded",
        target: {
          targetEntityType: "School",
          targetEntityId: input.schoolId,
        },
        context: buildPlatformSchoolAuditContext(input.req, {
          platformAdminId: input.actor.userId,
          schoolId: input.schoolId,
          actorEmail: input.actor.email,
          actorName: null,
          idempotencyKey: resolveAuditIdempotencyKey(
            input.req,
            `${actionCode}:${String(input.schoolId)}`,
          ),
        }),
        reason: {
          reasonCode: input.kind === "activation" ? "school_activation" : "school_reactivation",
          reason: input.reason,
        },
        payload: {
          before: { status: school.status },
          after: { status: "active" },
          changedFields: ["status"],
          metadata: {
            transitionKind: input.kind,
            setupProgress: {
              percent: setupProgress.percent,
              completed: setupProgress.completed,
              total: setupProgress.total,
              remainingItems: setupProgress.items
                .filter((item) => !item.complete)
                .map(({ key, label }) => ({ key, label })),
            },
          },
        },
        streamKey: `school:${String(input.schoolId)}:identity`,
      });

      result = {
        schoolId: String(updated._id),
        status: "active",
        previousStatus: school.status,
        transitioned: true,
        setupProgress,
      };
    });
  } catch (error) {
    if (error instanceof SchoolActiveTransitionError && error.code === "ACTIVATION_CONFLICT") {
      const current = await School.findById(input.schoolId)
        .select("_id status")
        .lean<{ _id: Types.ObjectId; status: "pending" | "active" | "deactivated" } | null>();
      if (current?.status === "active") {
        return {
          schoolId: String(current._id),
          status: "active",
          previousStatus: "active",
          transitioned: false,
          setupProgress,
        };
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }

  if (!result) {
    throw new SchoolActiveTransitionError("ACTIVATION_CONFLICT");
  }
  return result;
}
