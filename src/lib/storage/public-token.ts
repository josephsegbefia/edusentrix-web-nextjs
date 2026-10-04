import { Types } from "mongoose";
import { AdmissionApplication } from "@/models/AdmissionApplication";
import { AdmissionCycle } from "@/models/AdmissionCycle";
import { Student } from "@/models/Student";
import { StorageValidationError, type StorageActor, type StorageKind } from "./types";

export type PublicUploadTokenInput = {
  supplementalRequestToken?: string;
  studentParentDocumentToken?: string;
  applicantToken?: string;
  schoolId?: string;
  cycleSlug?: string;
};

export type ResolvedPublicUpload = {
  actor: StorageActor;
  kind: StorageKind;
};

function countModes(input: PublicUploadTokenInput): number {
  return [
    Boolean(input.supplementalRequestToken),
    Boolean(input.studentParentDocumentToken),
    Boolean(input.applicantToken),
    Boolean(input.schoolId && input.cycleSlug),
  ].filter(Boolean).length;
}

export async function resolvePublicUploadActor(
  input: PublicUploadTokenInput
): Promise<ResolvedPublicUpload> {
  if (countModes(input) !== 1) {
    throw new StorageValidationError(
      "Provide exactly one of supplementalRequestToken, studentParentDocumentToken, applicantToken, or schoolId+cycleSlug"
    );
  }

  let resolvedSchoolId: string | null = null;
  let kind: StorageKind = "admission_document";

  if (input.supplementalRequestToken) {
    const app = await AdmissionApplication.findOne({
      supplementalDocumentRequests: {
        $elemMatch: {
          token: input.supplementalRequestToken,
          fulfilledAt: null,
        },
      },
    })
      .select({ schoolId: 1, status: 1 })
      .lean();
    if (!app) {
      throw new StorageValidationError("Invalid or completed document request");
    }
    if (
      app.status === "accepted" ||
      app.status === "rejected" ||
      app.status === "withdrawn" ||
      app.status === "expired"
    ) {
      throw new StorageValidationError("This application is no longer accepting documents");
    }
    resolvedSchoolId = String(app.schoolId);
  } else if (input.studentParentDocumentToken) {
    const stu = await Student.findOne({
      parentDocumentRequests: {
        $elemMatch: {
          token: input.studentParentDocumentToken,
          fulfilledAt: null,
        },
      },
    })
      .select({ schoolId: 1 })
      .lean();
    if (!stu) {
      throw new StorageValidationError("Invalid or completed document request");
    }
    resolvedSchoolId = String(stu.schoolId);
    kind = "parent_document";
  } else if (input.applicantToken) {
    const app = await AdmissionApplication.findOne({
      "tracker.token": input.applicantToken,
    })
      .select({ schoolId: 1, cycleId: 1, status: 1 })
      .lean();
    if (!app) {
      throw new StorageValidationError("Invalid application token");
    }
    resolvedSchoolId = String(app.schoolId);
  } else if (input.schoolId && input.cycleSlug) {
    const cycle = await AdmissionCycle.findOne({
      schoolId: input.schoolId,
      slug: input.cycleSlug,
    })
      .select({ schoolId: 1, status: 1 })
      .lean();
    if (!cycle) {
      throw new StorageValidationError("Cycle not found");
    }
    if (cycle.status !== "published") {
      throw new StorageValidationError("Cycle is not accepting applications");
    }
    resolvedSchoolId = String(cycle.schoolId);
  }

  if (!resolvedSchoolId || !Types.ObjectId.isValid(resolvedSchoolId)) {
    throw new StorageValidationError("Missing token or cycle reference");
  }

  return {
    kind,
    actor: {
      userId: null,
      schoolId: new Types.ObjectId(resolvedSchoolId),
      roles: [],
      isPublicToken: true,
    },
  };
}

export function parsePublicUploadTokenInput(
  body: Record<string, unknown> | null
): PublicUploadTokenInput {
  const asString = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : undefined;
  return {
    supplementalRequestToken: asString(body?.supplementalRequestToken),
    studentParentDocumentToken: asString(body?.studentParentDocumentToken),
    applicantToken: asString(body?.applicantToken),
    schoolId: asString(body?.schoolId),
    cycleSlug: asString(body?.cycleSlug),
  };
}
