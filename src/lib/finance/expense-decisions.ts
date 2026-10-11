import mongoose from "mongoose";
import { SchoolExpense } from "@/models/SchoolExpense";
import { recordActivity } from "@/lib/audit/recordActivity";

/**
 * Expense approve / reject with strict maker-checker.
 *
 * The person who created or submitted an expense can never approve or reject it, with no
 * single-person exception. The check is part of the conditional write, together with the school
 * and the `submitted` status, so at most one decision succeeds and the activity is recorded once.
 *
 * This is an interim control. Expense approval is still open to `school_admin` and `bursar`
 * (requireFinanceStaff); owner-only expense approval is not enforced here.
 */

export const EXPENSE_NOTE_MAX = 500;

export type ExpenseDecisionAction = "approve" | "reject";

export type ExpenseDecisionResult =
  | { ok: true; expenseId: mongoose.Types.ObjectId }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "stale"; status: string | null }
  | { ok: false; reason: "maker_checker" };

type ExpenseActors = {
  status?: string;
  createdBy?: unknown;
  submittedBy?: unknown;
};

export function isExpenseMaker(expense: ExpenseActors, actorUserId: unknown): boolean {
  const actor = String(actorUserId);
  return (
    (expense.createdBy != null && String(expense.createdBy) === actor) ||
    (expense.submittedBy != null && String(expense.submittedBy) === actor)
  );
}

export async function decideExpense(args: {
  expenseId: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  actorUserId: unknown;
  action: ExpenseDecisionAction;
  text: string | null;
}): Promise<ExpenseDecisionResult> {
  const { expenseId, schoolId, action } = args;
  const actorId = new mongoose.Types.ObjectId(String(args.actorUserId));
  const now = new Date();

  const set =
    action === "approve"
      ? {
          status: "approved",
          approvedAt: now,
          approvedBy: actorId,
          approvalNote: args.text || null,
          lockedAt: now,
          lockReason: "approved",
        }
      : {
          status: "rejected",
          rejectedAt: now,
          rejectedBy: actorId,
          rejectionReason: args.text,
        };

  const updated = (await SchoolExpense.findOneAndUpdate(
    {
      _id: expenseId,
      schoolId,
      status: "submitted",
      createdBy: { $ne: actorId },
      submittedBy: { $ne: actorId },
    },
    { $set: set },
    { new: true }
  ).lean()) as { _id: mongoose.Types.ObjectId; expenseNumber?: string; amountMinor?: number; currency?: string } | null;

  if (!updated) {
    const latest = (await SchoolExpense.findOne({ _id: expenseId, schoolId })
      .select("status createdBy submittedBy")
      .lean()) as ExpenseActors | null;
    if (!latest) {
      return { ok: false, reason: "not_found" };
    }
    if (latest.status === "submitted" && isExpenseMaker(latest, actorId)) {
      return { ok: false, reason: "maker_checker" };
    }
    return { ok: false, reason: "stale", status: latest.status ?? null };
  }

  await recordActivity({
    schoolId: String(schoolId),
    userId: String(actorId),
    type: action === "approve" ? "expense.approved" : "expense.rejected",
    description:
      action === "approve"
        ? `Approved expense ${updated.expenseNumber}`
        : `Rejected expense ${updated.expenseNumber}: ${args.text}`,
    metadata:
      action === "approve"
        ? {
            expenseId: updated._id,
            expenseNumber: updated.expenseNumber,
            amountMinor: updated.amountMinor,
            currency: updated.currency,
          }
        : {
            expenseId: updated._id,
            expenseNumber: updated.expenseNumber,
            reason: args.text,
          },
  });

  return { ok: true, expenseId: updated._id };
}
