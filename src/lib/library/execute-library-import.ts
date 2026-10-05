import "server-only";

import mongoose from "mongoose";
import { BackgroundJobError } from "@/lib/background/errors";
import type { TrackedJobContext } from "@/lib/background/worker-wrapper";
import { executeLibraryImportJob } from "@/lib/library/library-import.service";
import { libraryImportActionUrl } from "@/lib/library/enqueue-library-import";
import { LibraryImportJob } from "@/models/LibraryImportJob";

export async function executeLibraryImportBackground(
  tracked: TrackedJobContext
): Promise<Record<string, unknown>> {
  const libraryImportJobId =
    typeof tracked.job.input?.libraryImportJobId === "string"
      ? tracked.job.input.libraryImportJobId
      : null;
  if (!libraryImportJobId || !mongoose.Types.ObjectId.isValid(libraryImportJobId)) {
    throw new BackgroundJobError({
      message: "libraryImportJobId is required",
      category: "PREREQUISITE_FAILED",
    });
  }

  const domain = await LibraryImportJob.findById(libraryImportJobId);
  if (!domain) {
    throw new BackgroundJobError({
      message: "Library import job not found",
      category: "PREREQUISITE_FAILED",
    });
  }
  if (String(domain.schoolId) !== String(tracked.job.schoolId)) {
    throw new BackgroundJobError({
      message: "Library import tenant mismatch",
      category: "PREREQUISITE_FAILED",
    });
  }

  const terminal = ["completed", "failed", "completed_with_errors"];
  if (terminal.includes(domain.status) && !domain.csvText) {
    return {
      libraryImportJobId,
      processed: domain.totalRows,
      succeeded: domain.successfulRows,
      failed: domain.failedRows,
      notification: {
        title: "Library import completed",
        body: "Library import complete.",
        actionUrl: libraryImportActionUrl(),
      },
    };
  }

  await tracked.throwIfCancellationRequested();
  await tracked.updateProgress({
    progressPercent: 5,
    progressStage: "validating",
    progressMessage: "Validating library import",
  });
  await tracked.updateProgress({
    progressPercent: 20,
    progressStage: "parsing",
    progressMessage: "Parsing CSV",
  });
  await tracked.updateProgress({
    progressPercent: 60,
    progressStage: "importing",
    progressMessage: "Importing rows",
  });

  const finished = await executeLibraryImportJob(
    domain.schoolId,
    domain._id,
    domain.createdBy
  );
  if (!finished) {
    throw new BackgroundJobError({
      message: "Library import job disappeared",
      category: "PREREQUISITE_FAILED",
    });
  }

  if (finished.status === "failed" && finished.successfulRows === 0) {
    const firstError = finished.errors[0]?.message || "Library import failed";
    throw new BackgroundJobError({
      message: firstError,
      category: /too many rows|required|invalid/i.test(firstError)
        ? "PERMANENT"
        : "RETRYABLE",
    });
  }

  await tracked.updateProgress({
    progressPercent: 100,
    progressStage: "complete",
    progressMessage: "Library import complete",
  });

  return {
    libraryImportJobId,
    processed: finished.totalRows,
    succeeded: finished.successfulRows,
    failed: finished.failedRows,
    notification: {
      title: "Library import completed",
      body: "Library import complete.",
      actionUrl: libraryImportActionUrl(),
    },
  };
}
