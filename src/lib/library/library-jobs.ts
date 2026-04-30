import mongoose from "mongoose";
import { LibraryLoan } from "@/models/LibraryLoan";
import { LibrarySettings } from "@/models/LibrarySettings";
import { enqueueLibraryLoanDueSoonNotifications } from "@/lib/library/library-notifications";

const MS_DAY = 86_400_000;

/**
 * V1.2 — Transition open loans whose due date has passed from `active` to `overdue`.
 * Idempotent. Run from dashboard/list loads or a future cron; documented in PROGRESS.
 */
export async function markOpenLoansOverdueForSchool(
  schoolId: mongoose.Types.ObjectId
): Promise<number> {
  const r = await LibraryLoan.updateMany(
    {
      schoolId,
      isOpen: true,
      status: "active",
      dueAt: { $lt: new Date() },
    },
    { $set: { status: "overdue" } }
  );
  return r.modifiedCount ?? 0;
}

/**
 * Transition all open loans past `dueAt` from `active` → `overdue` (all schools).
 * Idempotent. Prefer running from a daily cron; list/dashboard loads still run per-school.
 */
export async function markOpenLoansOverdueGlobally(): Promise<{ modifiedCount: number }> {
  const r = await LibraryLoan.updateMany(
    {
      isOpen: true,
      status: "active",
      dueAt: { $lt: new Date() },
    },
    { $set: { status: "overdue" } }
  );
  return { modifiedCount: r.modifiedCount ?? 0 };
}

/**
 * For schools with `notifyBeforeDueDate`, notify borrowers of active loans due within
 * `dueReminderDaysBefore` days. Idempotent per loan via `lastDueSoonReminderAt` (20h debounce).
 */
export async function enqueueDueSoonLibraryLoanRemindersGlobally(now = new Date()): Promise<{
  schoolCount: number;
  candidateLoans: number;
  loansMarked: number;
}> {
  const settingsRows = await LibrarySettings.find({
    notifyBeforeDueDate: true,
    dueReminderDaysBefore: { $gt: 0 },
  })
    .select("schoolId dueReminderDaysBefore")
    .lean();

  let candidateLoans = 0;
  let loansMarked = 0;
  const debounceMs = 20 * 3600_000;

  for (const s of settingsRows) {
    const schoolId = s.schoolId as mongoose.Types.ObjectId;
    const days = Math.min(30, Math.max(1, Number(s.dueReminderDaysBefore) || 1));
    const windowEnd = new Date(now.getTime() + days * MS_DAY);

    const loans = await LibraryLoan.find({
      schoolId,
      isOpen: true,
      status: "active",
      dueAt: { $gt: now, $lte: windowEnd },
    })
      .select("_id lastDueSoonReminderAt")
      .lean();

    const ids: mongoose.Types.ObjectId[] = [];
    for (const loan of loans) {
      if (
        loan.lastDueSoonReminderAt &&
        now.getTime() - loan.lastDueSoonReminderAt.getTime() < debounceMs
      ) {
        continue;
      }
      ids.push(loan._id as mongoose.Types.ObjectId);
    }

    if (ids.length === 0) continue;
    candidateLoans += ids.length;
    const { loansMarked: marked } = await enqueueLibraryLoanDueSoonNotifications({
      schoolId,
      loanIds: ids,
    });
    loansMarked += marked;
  }

  return {
    schoolCount: settingsRows.length,
    candidateLoans,
    loansMarked,
  };
}
