import "server-only";

import {
  EmailSuppression,
  type IEmailSuppression,
} from "@/models/EmailSuppression";

/**
 * Check if an email address is hard-suppressed (bounce, complaint, manual block).
 * Returns the active suppression record if one exists.
 */
export async function checkHardSuppression(
  email: string,
  schoolId?: string | null,
): Promise<IEmailSuppression | null> {
  const query: Record<string, unknown> = {
    email: email.toLowerCase().trim(),
    active: true,
    reason: { $in: ["bounce", "complaint", "manual_block"] },
  };

  if (schoolId) {
    query.$or = [{ scope: "global" }, { scope: "school", schoolId }];
  } else {
    query.scope = "global";
  }

  const suppression = await EmailSuppression.findOne(query).lean();
  return suppression as IEmailSuppression | null;
}

/**
 * Check if an email address has opted out of a specific category.
 */
export async function checkCategoryOptOut(
  email: string,
  category: string,
  schoolId?: string | null,
): Promise<boolean> {
  const query: Record<string, unknown> = {
    email: email.toLowerCase().trim(),
    active: true,
    reason: "unsubscribe_optional",
    categories: category,
  };

  if (schoolId) {
    query.$or = [{ scope: "global" }, { scope: "school", schoolId }];
  } else {
    query.scope = "global";
  }

  const found = await EmailSuppression.findOne(query).lean();
  return !!found;
}

/**
 * Apply a hard suppression for an email address (bounce or complaint).
 * Upserts to avoid duplicates.
 */
export async function applySuppression(opts: {
  email: string;
  reason: "bounce" | "complaint" | "manual_block";
  scope: "global" | "school";
  schoolId?: string | null;
  sourceProvider?: string | null;
}): Promise<void> {
  const filter: Record<string, unknown> = {
    email: opts.email.toLowerCase().trim(),
    scope: opts.scope,
    reason: opts.reason,
  };
  if (opts.scope === "school" && opts.schoolId) {
    filter.schoolId = opts.schoolId;
  }

  await EmailSuppression.findOneAndUpdate(
    filter,
    {
      $set: {
        active: true,
        sourceProvider: opts.sourceProvider || null,
      },
      $setOnInsert: {
        email: opts.email.toLowerCase().trim(),
        scope: opts.scope,
        reason: opts.reason,
        schoolId: opts.schoolId || null,
      },
    },
    { upsert: true },
  );
}

/**
 * Remove a suppression (reactivate delivery for an email address).
 */
export async function liftSuppression(
  email: string,
  reason: string,
  scope: "global" | "school",
  schoolId?: string | null,
): Promise<void> {
  const filter: Record<string, unknown> = {
    email: email.toLowerCase().trim(),
    scope,
    reason,
    active: true,
  };
  if (scope === "school" && schoolId) {
    filter.schoolId = schoolId;
  }

  await EmailSuppression.updateMany(filter, { $set: { active: false } });
}
