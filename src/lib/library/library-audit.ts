import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import {
  buildSchoolUserAuditContext,
  resolveAuditIdempotencyKey,
} from "@/lib/audit/fromApiRoute";
import { writeRetryableAuditEvent } from "@/lib/audit/writeRetryableAuditEvent";
import type { AuditTarget } from "@/lib/audit/types";

function libraryStreamKey(schoolId: mongoose.Types.ObjectId) {
  return `school:${String(schoolId)}:library`;
}

function stablePatchIdempotency(prefix: string, patch: Record<string, unknown>) {
  const keys = Object.keys(patch).sort();
  const ordered: Record<string, unknown> = {};
  for (const k of keys) ordered[k] = patch[k];
  return `${prefix}:${JSON.stringify(ordered)}`;
}

export async function auditLibraryBookCreated(
  req: NextRequest,
  schoolId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  bookId: mongoose.Types.ObjectId,
  metadata: Record<string, unknown>
) {
  try {
    await writeRetryableAuditEvent({
      actionCode: "library.book.created",
      scopeType: "school",
      scopeId: String(schoolId),
      result: "succeeded",
      target: {
        targetEntityType: "LibraryBook",
        targetEntityId: bookId,
      },
      context: buildSchoolUserAuditContext(req, {
        userId,
        schoolId,
        actorRole: "school_admin",
        idempotencyKey: resolveAuditIdempotencyKey(
          req,
          `library.book.created:${String(bookId)}`
        ),
      }),
      payload: { metadata },
      streamKey: libraryStreamKey(schoolId),
    });
  } catch (e) {
    console.error("library.book.created audit failed:", e);
  }
}

export async function auditLibraryBookUpdated(
  req: NextRequest,
  schoolId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  bookId: mongoose.Types.ObjectId,
  patch: Record<string, unknown>
) {
  try {
    await writeRetryableAuditEvent({
      actionCode: "library.book.updated",
      scopeType: "school",
      scopeId: String(schoolId),
      result: "succeeded",
      target: {
        targetEntityType: "LibraryBook",
        targetEntityId: bookId,
      },
      context: buildSchoolUserAuditContext(req, {
        userId,
        schoolId,
        actorRole: "school_admin",
        idempotencyKey: resolveAuditIdempotencyKey(
          req,
          stablePatchIdempotency(`library.book.updated:${String(bookId)}`, patch)
        ),
      }),
      payload: {
        metadata: {
          updatedKeys: Object.keys(patch),
        },
      },
      streamKey: libraryStreamKey(schoolId),
    });
  } catch (e) {
    console.error("library.book.updated audit failed:", e);
  }
}

export async function auditLibraryCopyCreated(
  req: NextRequest,
  schoolId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  copyId: mongoose.Types.ObjectId,
  bookId: mongoose.Types.ObjectId,
  metadata: Record<string, unknown>
) {
  try {
    const target: AuditTarget = {
      targetEntityType: "LibraryBookCopy",
      targetEntityId: copyId,
      secondaryEntityType: "LibraryBook",
      secondaryEntityId: bookId,
    };
    await writeRetryableAuditEvent({
      actionCode: "library.copy.created",
      scopeType: "school",
      scopeId: String(schoolId),
      result: "succeeded",
      target,
      context: buildSchoolUserAuditContext(req, {
        userId,
        schoolId,
        actorRole: "school_admin",
        idempotencyKey: resolveAuditIdempotencyKey(
          req,
          `library.copy.created:${String(copyId)}`
        ),
      }),
      payload: { metadata },
      streamKey: libraryStreamKey(schoolId),
    });
  } catch (e) {
    console.error("library.copy.created audit failed:", e);
  }
}

export async function auditLibraryCopyUpdated(
  req: NextRequest,
  schoolId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  copyId: mongoose.Types.ObjectId,
  patch: Record<string, unknown>
) {
  try {
    await writeRetryableAuditEvent({
      actionCode: "library.copy.updated",
      scopeType: "school",
      scopeId: String(schoolId),
      result: "succeeded",
      target: {
        targetEntityType: "LibraryBookCopy",
        targetEntityId: copyId,
      },
      context: buildSchoolUserAuditContext(req, {
        userId,
        schoolId,
        actorRole: "school_admin",
        idempotencyKey: resolveAuditIdempotencyKey(
          req,
          stablePatchIdempotency(`library.copy.updated:${String(copyId)}`, patch)
        ),
      }),
      payload: {
        metadata: {
          updatedKeys: Object.keys(patch),
        },
      },
      streamKey: libraryStreamKey(schoolId),
    });
  } catch (e) {
    console.error("library.copy.updated audit failed:", e);
  }
}

export async function auditLibrarySettingsUpdated(
  req: NextRequest,
  schoolId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  settingsId: mongoose.Types.ObjectId,
  patch: Record<string, unknown>
) {
  try {
    await writeRetryableAuditEvent({
      actionCode: "library.settings.updated",
      scopeType: "school",
      scopeId: String(schoolId),
      result: "succeeded",
      target: {
        targetEntityType: "LibrarySettings",
        targetEntityId: settingsId,
      },
      context: buildSchoolUserAuditContext(req, {
        userId,
        schoolId,
        actorRole: "school_admin",
        idempotencyKey: resolveAuditIdempotencyKey(
          req,
          stablePatchIdempotency(
            `library.settings.updated:${String(settingsId)}`,
            patch
          )
        ),
      }),
      payload: {
        metadata: {
          updatedKeys: Object.keys(patch),
        },
      },
      streamKey: libraryStreamKey(schoolId),
    });
  } catch (e) {
    console.error("library.settings.updated audit failed:", e);
  }
}

export async function auditLibraryLoanIssued(
  req: NextRequest,
  schoolId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  loanId: mongoose.Types.ObjectId,
  metadata: Record<string, unknown>
) {
  try {
    await writeRetryableAuditEvent({
      actionCode: "library.loan.issued",
      scopeType: "school",
      scopeId: String(schoolId),
      result: "succeeded",
      target: {
        targetEntityType: "LibraryLoan",
        targetEntityId: loanId,
      },
      context: buildSchoolUserAuditContext(req, {
        userId,
        schoolId,
        actorRole: "school_admin",
        idempotencyKey: resolveAuditIdempotencyKey(req, `library.loan.issued:${String(loanId)}`),
      }),
      payload: { metadata },
      streamKey: libraryStreamKey(schoolId),
    });
  } catch (e) {
    console.error("library.loan.issued audit failed:", e);
  }
}

export async function auditLibraryLoanReturned(
  req: NextRequest,
  schoolId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  loanId: mongoose.Types.ObjectId,
  metadata: Record<string, unknown>
) {
  try {
    await writeRetryableAuditEvent({
      actionCode: "library.loan.returned",
      scopeType: "school",
      scopeId: String(schoolId),
      result: "succeeded",
      target: {
        targetEntityType: "LibraryLoan",
        targetEntityId: loanId,
      },
      context: buildSchoolUserAuditContext(req, {
        userId,
        schoolId,
        actorRole: "school_admin",
        idempotencyKey: resolveAuditIdempotencyKey(req, `library.loan.returned:${String(loanId)}`),
      }),
      payload: { metadata },
      streamKey: libraryStreamKey(schoolId),
    });
  } catch (e) {
    console.error("library.loan.returned audit failed:", e);
  }
}

export async function auditLibraryLoanRenewed(
  req: NextRequest,
  schoolId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  loanId: mongoose.Types.ObjectId,
  patch: Record<string, unknown>
) {
  try {
    await writeRetryableAuditEvent({
      actionCode: "library.loan.renewed",
      scopeType: "school",
      scopeId: String(schoolId),
      result: "succeeded",
      target: {
        targetEntityType: "LibraryLoan",
        targetEntityId: loanId,
      },
      context: buildSchoolUserAuditContext(req, {
        userId,
        schoolId,
        actorRole: "school_admin",
        idempotencyKey: resolveAuditIdempotencyKey(
          req,
          stablePatchIdempotency(`library.loan.renewed:${String(loanId)}`, patch)
        ),
      }),
      payload: {
        metadata: {
          updatedKeys: Object.keys(patch),
        },
      },
      streamKey: libraryStreamKey(schoolId),
    });
  } catch (e) {
    console.error("library.loan.renewed audit failed:", e);
  }
}

export async function auditLibraryLoanFineWaived(
  req: NextRequest,
  schoolId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  loanId: mongoose.Types.ObjectId,
  metadata: Record<string, unknown>
) {
  try {
    await writeRetryableAuditEvent({
      actionCode: "library.loan.fine_waived",
      scopeType: "school",
      scopeId: String(schoolId),
      result: "succeeded",
      target: {
        targetEntityType: "LibraryLoan",
        targetEntityId: loanId,
      },
      context: buildSchoolUserAuditContext(req, {
        userId,
        schoolId,
        actorRole: "school_admin",
        idempotencyKey: resolveAuditIdempotencyKey(
          req,
          `library.loan.fine_waived:${String(loanId)}`
        ),
      }),
      payload: { metadata },
      streamKey: libraryStreamKey(schoolId),
    });
  } catch (e) {
    console.error("library.loan.fine_waived audit failed:", e);
  }
}

export async function auditLibraryImportCompleted(
  req: NextRequest,
  schoolId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  jobId: mongoose.Types.ObjectId,
  metadata: Record<string, unknown>
) {
  try {
    await writeRetryableAuditEvent({
      actionCode: "library.import.completed",
      scopeType: "school",
      scopeId: String(schoolId),
      result: "succeeded",
      target: {
        targetEntityType: "LibraryImportJob",
        targetEntityId: jobId,
      },
      context: buildSchoolUserAuditContext(req, {
        userId,
        schoolId,
        actorRole: "school_admin",
        idempotencyKey: resolveAuditIdempotencyKey(
          req,
          `library.import.completed:${String(jobId)}`
        ),
      }),
      payload: { metadata },
      streamKey: libraryStreamKey(schoolId),
    });
  } catch (e) {
    console.error("library.import.completed audit failed:", e);
  }
}

export async function auditLibraryReservationCreated(
  req: NextRequest,
  schoolId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  reservationId: mongoose.Types.ObjectId,
  metadata: Record<string, unknown>
) {
  try {
    await writeRetryableAuditEvent({
      actionCode: "library.reservation.created",
      scopeType: "school",
      scopeId: String(schoolId),
      result: "succeeded",
      target: {
        targetEntityType: "LibraryReservation",
        targetEntityId: reservationId,
      },
      context: buildSchoolUserAuditContext(req, {
        userId,
        schoolId,
        actorRole: "school_admin",
        idempotencyKey: resolveAuditIdempotencyKey(
          req,
          `library.reservation.created:${String(reservationId)}`
        ),
      }),
      payload: { metadata },
      streamKey: libraryStreamKey(schoolId),
    });
  } catch (e) {
    console.error("library.reservation.created audit failed:", e);
  }
}

export async function auditLibraryReservationCancelled(
  req: NextRequest,
  schoolId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  reservationId: mongoose.Types.ObjectId,
  metadata: Record<string, unknown>
) {
  try {
    await writeRetryableAuditEvent({
      actionCode: "library.reservation.cancelled",
      scopeType: "school",
      scopeId: String(schoolId),
      result: "succeeded",
      target: {
        targetEntityType: "LibraryReservation",
        targetEntityId: reservationId,
      },
      context: buildSchoolUserAuditContext(req, {
        userId,
        schoolId,
        actorRole: "school_admin",
        idempotencyKey: resolveAuditIdempotencyKey(
          req,
          `library.reservation.cancelled:${String(reservationId)}`
        ),
      }),
      payload: { metadata },
      streamKey: libraryStreamKey(schoolId),
    });
  } catch (e) {
    console.error("library.reservation.cancelled audit failed:", e);
  }
}

export async function auditLibraryReservationFulfilled(
  req: NextRequest,
  schoolId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  reservationId: mongoose.Types.ObjectId,
  metadata: Record<string, unknown>
) {
  try {
    await writeRetryableAuditEvent({
      actionCode: "library.reservation.fulfilled",
      scopeType: "school",
      scopeId: String(schoolId),
      result: "succeeded",
      target: {
        targetEntityType: "LibraryReservation",
        targetEntityId: reservationId,
      },
      context: buildSchoolUserAuditContext(req, {
        userId,
        schoolId,
        actorRole: "school_admin",
        idempotencyKey: resolveAuditIdempotencyKey(
          req,
          `library.reservation.fulfilled:${String(reservationId)}`
        ),
      }),
      payload: { metadata },
      streamKey: libraryStreamKey(schoolId),
    });
  } catch (e) {
    console.error("library.reservation.fulfilled audit failed:", e);
  }
}

export async function auditLibraryReservationExpired(
  schoolId: mongoose.Types.ObjectId,
  reservationId: mongoose.Types.ObjectId,
  metadata: Record<string, unknown>
) {
  try {
    const requestId = randomUUID();
    await writeRetryableAuditEvent({
      actionCode: "library.reservation.expired",
      scopeType: "school",
      scopeId: String(schoolId),
      result: "succeeded",
      target: {
        targetEntityType: "LibraryReservation",
        targetEntityId: reservationId,
      },
      context: {
        requestId,
        correlationId: requestId,
        idempotencyKey: `library.reservation.expired:${String(reservationId)}`,
        actorType: "job",
        actorId: null,
        actorRole: "library_reservation_expiry",
        actorEmail: null,
        actorName: "library.reservation.expiry",
        schoolId,
        ipAddress: null,
        userAgent: null,
        routePath: "/cron/library-reservation-expiry",
        clientSurface: "cron",
      },
      payload: { metadata },
      streamKey: libraryStreamKey(schoolId),
    });
  } catch (e) {
    console.error("library.reservation.expired audit failed:", e);
  }
}
