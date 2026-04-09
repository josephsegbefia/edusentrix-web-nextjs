import type { Types } from "mongoose";
import { Invitation } from "@/models/Invitation";
import { School, type ISchool } from "@/models/School";
import { deriveSchoolPaymentSetupStatusWithoutOwnerHandoff } from "@/lib/school-payments/payment-setup";

type ObjectIdLike = Types.ObjectId | string;

type PaymentSetupSchoolRow = Pick<ISchool, "_id" | "bank" | "billing">;

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

export async function assignPendingBillingOwnerInvitation(input: {
  schoolId: ObjectIdLike;
  ownerEmail: string;
  ownerName?: string | null;
  updatedBy?: ObjectIdLike | null;
}) {
  const school = await School.findById(input.schoolId)
    .select("billing")
    .lean<Pick<ISchool, "billing"> | null>();

  if (!school) return false;

  const now = new Date();

  await School.findByIdAndUpdate(input.schoolId, {
    $set: {
      "billing.paymentSetup.ownerUserId": null,
      "billing.paymentSetup.ownerName": input.ownerName?.trim() || null,
      "billing.paymentSetup.ownerEmail": normalizeEmail(input.ownerEmail),
      "billing.paymentSetup.ownerAssignedAt": now,
      ...(input.updatedBy
        ? { "billing.paymentSetup.ownerAssignedBy": input.updatedBy }
        : {}),
      "billing.paymentSetup.lastUpdatedAt": now,
      ...(input.updatedBy
        ? { "billing.paymentSetup.lastUpdatedBy": input.updatedBy }
        : {}),
      ...(school.billing?.paystack?.subaccountCode
        ? {}
        : { "billing.paymentSetup.status": "awaiting_billing_owner" }),
    },
  });

  return true;
}

export async function releasePendingBillingOwnerInvitation(input: {
  schoolId: ObjectIdLike;
  ownerEmail: string;
  updatedBy?: ObjectIdLike | null;
}) {
  const school = await School.findById(input.schoolId)
    .select("bank billing")
    .lean<PaymentSetupSchoolRow | null>();

  if (!school) return false;

  const currentOwnerEmail = school.billing?.paymentSetup?.ownerEmail
    ? normalizeEmail(school.billing.paymentSetup.ownerEmail)
    : null;

  if (!currentOwnerEmail || currentOwnerEmail !== normalizeEmail(input.ownerEmail)) {
    return false;
  }

  if (school.billing?.paymentSetup?.ownerUserId) {
    return false;
  }

  const nextStatus = deriveSchoolPaymentSetupStatusWithoutOwnerHandoff(school);
  const now = new Date();

  await School.findByIdAndUpdate(input.schoolId, {
    $set: {
      "billing.paymentSetup.ownerUserId": null,
      "billing.paymentSetup.ownerName": null,
      "billing.paymentSetup.ownerEmail": null,
      "billing.paymentSetup.ownerAssignedAt": null,
      "billing.paymentSetup.ownerAssignedBy": null,
      "billing.paymentSetup.status": nextStatus,
      "billing.paymentSetup.lastUpdatedAt": now,
      ...(input.updatedBy
        ? { "billing.paymentSetup.lastUpdatedBy": input.updatedBy }
        : {}),
    },
  });

  return true;
}

export async function bindBillingOwnerToSchool(input: {
  schoolId: ObjectIdLike;
  userId: ObjectIdLike;
  email: string;
  name?: string | null;
}) {
  const normalizedEmail = normalizeEmail(input.email);

  const result = await School.updateOne(
    {
      _id: input.schoolId,
      $or: [
        { "billing.paymentSetup.ownerUserId": input.userId },
        { "billing.paymentSetup.ownerEmail": normalizedEmail },
      ],
    },
    {
      $set: {
        "billing.paymentSetup.ownerUserId": input.userId,
        "billing.paymentSetup.ownerName": input.name?.trim() || normalizedEmail,
        "billing.paymentSetup.ownerEmail": normalizedEmail,
        "billing.paymentSetup.lastUpdatedAt": new Date(),
        "billing.paymentSetup.lastUpdatedBy": input.userId,
      },
    }
  );

  return result.modifiedCount > 0;
}

export async function replaceBillingOwnerOnSchool(input: {
  schoolId: ObjectIdLike;
  userId: ObjectIdLike;
  email: string;
  name?: string | null;
}) {
  const now = new Date();
  const normalizedEmail = normalizeEmail(input.email);

  const result = await School.updateOne(
    { _id: input.schoolId },
    {
      $set: {
        "billing.paymentSetup.ownerUserId": input.userId,
        "billing.paymentSetup.ownerName": input.name?.trim() || normalizedEmail,
        "billing.paymentSetup.ownerEmail": normalizedEmail,
        "billing.paymentSetup.ownerAssignedAt": now,
        "billing.paymentSetup.lastUpdatedAt": now,
        "billing.paymentSetup.lastUpdatedBy": input.userId,
      },
    }
  );

  await Invitation.updateMany(
    {
      schoolId: input.schoolId,
      email: normalizedEmail,
      role: "billing_owner",
      status: { $in: ["pending", "accepted"] },
      "metadata.accessSurface": "payment_setup",
      "metadata.paymentAuthorityMode": "owner_replacement",
    },
    {
      $set: {
        status: "accepted",
        acceptedAt: now,
      },
    }
  );

  return result.modifiedCount > 0;
}

export async function assignPendingPaymentSetupDelegate(input: {
  schoolId: ObjectIdLike;
  delegateEmail: string;
  delegateName?: string | null;
  updatedBy?: ObjectIdLike | null;
}) {
  const now = new Date();

  await School.findByIdAndUpdate(input.schoolId, {
    $set: {
      "billing.paymentSetup.delegateUserId": null,
      "billing.paymentSetup.delegateName": input.delegateName?.trim() || null,
      "billing.paymentSetup.delegateEmail": normalizeEmail(input.delegateEmail),
      "billing.paymentSetup.delegateAssignedAt": now,
      ...(input.updatedBy
        ? { "billing.paymentSetup.delegateAssignedBy": input.updatedBy }
        : {}),
      "billing.paymentSetup.lastUpdatedAt": now,
      ...(input.updatedBy
        ? { "billing.paymentSetup.lastUpdatedBy": input.updatedBy }
        : {}),
    },
  });

  return true;
}

export async function bindPaymentSetupDelegateToSchool(input: {
  schoolId: ObjectIdLike;
  userId: ObjectIdLike;
  email: string;
  name?: string | null;
}) {
  const normalizedEmail = normalizeEmail(input.email);

  const result = await School.updateOne(
    {
      _id: input.schoolId,
      $or: [
        { "billing.paymentSetup.delegateUserId": input.userId },
        { "billing.paymentSetup.delegateEmail": normalizedEmail },
      ],
    },
    {
      $set: {
        "billing.paymentSetup.delegateUserId": input.userId,
        "billing.paymentSetup.delegateName": input.name?.trim() || normalizedEmail,
        "billing.paymentSetup.delegateEmail": normalizedEmail,
        "billing.paymentSetup.lastUpdatedAt": new Date(),
        "billing.paymentSetup.lastUpdatedBy": input.userId,
      },
    }
  );

  return result.modifiedCount > 0;
}

export async function releasePendingPaymentSetupDelegate(input: {
  schoolId: ObjectIdLike;
  delegateEmail: string;
  updatedBy?: ObjectIdLike | null;
}) {
  const school = await School.findById(input.schoolId)
    .select("billing")
    .lean<Pick<ISchool, "billing"> | null>();

  if (!school) return false;

  const currentDelegateEmail = school.billing?.paymentSetup?.delegateEmail
    ? normalizeEmail(school.billing.paymentSetup.delegateEmail)
    : null;

  if (!currentDelegateEmail || currentDelegateEmail !== normalizeEmail(input.delegateEmail)) {
    return false;
  }

  if (school.billing?.paymentSetup?.delegateUserId) {
    return false;
  }

  const now = new Date();

  await School.findByIdAndUpdate(input.schoolId, {
    $set: {
      "billing.paymentSetup.delegateUserId": null,
      "billing.paymentSetup.delegateName": null,
      "billing.paymentSetup.delegateEmail": null,
      "billing.paymentSetup.delegateAssignedAt": null,
      "billing.paymentSetup.delegateAssignedBy": null,
      "billing.paymentSetup.lastUpdatedAt": now,
      ...(input.updatedBy
        ? { "billing.paymentSetup.lastUpdatedBy": input.updatedBy }
        : {}),
    },
  });

  return true;
}

export async function clearPaymentSetupDelegate(input: {
  schoolId: ObjectIdLike;
  updatedBy?: ObjectIdLike | null;
}) {
  const now = new Date();

  await School.findByIdAndUpdate(input.schoolId, {
    $set: {
      "billing.paymentSetup.delegateUserId": null,
      "billing.paymentSetup.delegateName": null,
      "billing.paymentSetup.delegateEmail": null,
      "billing.paymentSetup.delegateAssignedAt": null,
      "billing.paymentSetup.delegateAssignedBy": null,
      "billing.paymentSetup.lastUpdatedAt": now,
      ...(input.updatedBy
        ? { "billing.paymentSetup.lastUpdatedBy": input.updatedBy }
        : {}),
    },
  });

  await Invitation.updateMany(
    {
      schoolId: input.schoolId,
      role: "bursar",
      status: "pending",
      "metadata.accessSurface": "payment_setup_delegate",
    },
    {
      $set: {
        status: "revoked",
        revokedAt: now,
      },
    }
  );

  return true;
}
