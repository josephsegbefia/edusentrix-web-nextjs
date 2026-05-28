import "server-only";

import { Types } from "mongoose";
import { School } from "@/models/School";
import { User } from "@/models/User";

type AdminRecipient = {
  userId: Types.ObjectId | null;
  email: string;
  name: string | null;
  role: string | null;
};

export async function resolveSchoolBillingRecipients(
  schoolId: string | Types.ObjectId
): Promise<AdminRecipient[]> {
  const normalizedSchoolId =
    schoolId instanceof Types.ObjectId ? schoolId : new Types.ObjectId(String(schoolId));

  const [school, users] = await Promise.all([
    School.findById(normalizedSchoolId)
      .select("name email billing.paymentSetup.ownerEmail billing.paymentSetup.ownerName billing.paymentSetup.delegateEmail billing.paymentSetup.delegateName")
      .lean<{
        name?: string | null;
        email?: string | null;
        billing?: {
          paymentSetup?: {
            ownerEmail?: string | null;
            ownerName?: string | null;
            delegateEmail?: string | null;
            delegateName?: string | null;
          } | null;
        } | null;
      } | null>(),
    User.find({
      schoolId: normalizedSchoolId,
      role: { $in: ["school_admin", "billing_owner", "bursar"] },
      email: { $exists: true, $ne: "" },
    })
      .select("_id email name firstName lastName role")
      .lean<
        Array<{
          _id: Types.ObjectId;
          email?: string | null;
          name?: string | null;
          firstName?: string | null;
          lastName?: string | null;
          role?: string | null;
        }>
      >(),
  ]);

  const recipients = new Map<string, AdminRecipient>();
  for (const user of users) {
    const email = user.email?.trim().toLowerCase();
    if (!email) continue;
    recipients.set(email, {
      userId: user._id,
      email,
      name:
        user.name ||
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        null,
      role: user.role ?? null,
    });
  }

  const ownerEmail = school?.billing?.paymentSetup?.ownerEmail?.trim().toLowerCase();
  if (ownerEmail && !recipients.has(ownerEmail)) {
    recipients.set(ownerEmail, {
      userId: null,
      email: ownerEmail,
      name: school?.billing?.paymentSetup?.ownerName ?? null,
      role: "billing_owner",
    });
  }

  const delegateEmail = school?.billing?.paymentSetup?.delegateEmail?.trim().toLowerCase();
  if (delegateEmail && !recipients.has(delegateEmail)) {
    recipients.set(delegateEmail, {
      userId: null,
      email: delegateEmail,
      name: school?.billing?.paymentSetup?.delegateName ?? null,
      role: "billing_delegate",
    });
  }

  const schoolEmail = school?.email?.trim().toLowerCase();
  if (schoolEmail && !recipients.has(schoolEmail)) {
    recipients.set(schoolEmail, {
      userId: null,
      email: schoolEmail,
      name: school?.name ?? null,
      role: "school_contact",
    });
  }

  return [...recipients.values()];
}
