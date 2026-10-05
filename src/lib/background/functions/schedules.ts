import { getInngestClient } from "../inngest";
import { reconcileStaleAndDispatchFailedJobs } from "../reconciliation";
import { runImapMailboxSync } from "@/lib/jobs/imapMailboxSync";
import { sendSubscriptionRenewalNotices } from "@/lib/subscriptions/renewal-notices";
import { applyDuePendingPlanChanges } from "@/lib/subscriptions/apply-plan-change";
import { runScheduledFinanceReconciliation } from "@/lib/jobs/run-scheduled-finance-reconciliation";
import {
  enqueueDueSoonLibraryLoanRemindersGlobally,
  markOpenLoansOverdueGlobally,
} from "@/lib/library/library-jobs";
import { expireStaleLibraryReservationsGlobally } from "@/lib/library/library-reservation-scheduler";
import { markExpiredDelegations } from "@/lib/delegations/expireDelegations";
import { sendDelegationExpiryReminders } from "@/lib/delegations/delegationExpiryReminders";
import { sendWeeklyDigestsForActiveCycles } from "@/lib/admissions/weekly-digest";

const SCHEDULE_CONCURRENCY = { limit: 1 } as const;

function scheduleFunction(
  id: string,
  cron: string,
  handler: () => Promise<unknown>
) {
  const inngest = getInngestClient();
  return inngest.createFunction(
    {
      id,
      concurrency: SCHEDULE_CONCURRENCY,
      triggers: [{ cron }],
    },
    async () => handler()
  );
}

export function createBackgroundJobReconciliationSchedule() {
  return scheduleFunction(
    "background-job-reconciliation",
    "TZ=UTC */5 * * * *",
    () => reconcileStaleAndDispatchFailedJobs()
  );
}

export function createImapRecoverySchedule() {
  return scheduleFunction("imap-recovery", "TZ=UTC */10 * * * *", () =>
    runImapMailboxSync()
  );
}

export function createSubscriptionRenewalNoticesSchedule() {
  return scheduleFunction("subscription-renewal-notices", "TZ=UTC 0 8 * * *", () =>
    sendSubscriptionRenewalNotices()
  );
}

export function createSubscriptionPlanChangesSchedule() {
  return scheduleFunction("subscription-plan-changes", "TZ=UTC 15 0 * * *", () =>
    applyDuePendingPlanChanges()
  );
}

export function createFinanceReconciliationSchedule() {
  return scheduleFunction("finance-reconciliation", "TZ=UTC 0 */6 * * *", () =>
    runScheduledFinanceReconciliation(50)
  );
}

export function createLibraryLoansOverdueSchedule() {
  return scheduleFunction("library-loans-overdue", "TZ=UTC 0 2 * * *", () =>
    markOpenLoansOverdueGlobally()
  );
}

export function createLibraryLoansDueSoonSchedule() {
  return scheduleFunction("library-loans-due-soon", "TZ=UTC 0 9 * * *", () =>
    enqueueDueSoonLibraryLoanRemindersGlobally()
  );
}

export function createLibraryReservationExpirySchedule() {
  return scheduleFunction("library-reservation-expiry", "TZ=UTC 0 3 * * *", () =>
    expireStaleLibraryReservationsGlobally()
  );
}

export function createDelegationsExpirySchedule() {
  return scheduleFunction("delegations-expiry", "TZ=UTC 30 6 * * *", async () => {
    const expired = await markExpiredDelegations();
    const reminders = await sendDelegationExpiryReminders();
    return { expired, reminders };
  });
}

export function createAdmissionsWeeklyDigestSchedule() {
  return scheduleFunction("admissions-weekly-digest", "TZ=UTC 0 7 * * 1", () =>
    sendWeeklyDigestsForActiveCycles()
  );
}

export function getRegisteredScheduleFunctions() {
  return [
    createBackgroundJobReconciliationSchedule(),
    createImapRecoverySchedule(),
    createSubscriptionRenewalNoticesSchedule(),
    createSubscriptionPlanChangesSchedule(),
    createFinanceReconciliationSchedule(),
    createLibraryLoansOverdueSchedule(),
    createLibraryLoansDueSoonSchedule(),
    createLibraryReservationExpirySchedule(),
    createDelegationsExpirySchedule(),
    createAdmissionsWeeklyDigestSchedule(),
  ];
}
