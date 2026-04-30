import type { ILibraryLoan } from "@/models/LibraryLoan";
import type { ILibrarySettings } from "@/models/LibrarySettings";

const MS_DAY = 86_400_000;

/**
 * Billable days after `dueAt + graceDays` (fine clock). No fine if returned on or before that instant.
 */
export function computeAutoFineOnReturn(
  loan: Pick<ILibraryLoan, "dueAt">,
  settings: Pick<
    ILibrarySettings,
    "enableFines" | "finePerDay" | "graceDaysAfterDueDate"
  >,
  returnedAt: Date
): number {
  if (!settings.enableFines) return 0;
  const graceDays = Math.max(0, settings.graceDaysAfterDueDate ?? 0);
  const fineStart = new Date(loan.dueAt.getTime() + graceDays * MS_DAY);
  if (returnedAt.getTime() <= fineStart.getTime()) return 0;
  const msLate = returnedAt.getTime() - fineStart.getTime();
  const billableDays = Math.max(0, Math.ceil(msLate / MS_DAY));
  return Math.round(billableDays * (settings.finePerDay ?? 0) * 100) / 100;
}
