import "server-only";
import mongoose from "mongoose";
import { User } from "@/models/User";
import type { InvitationRole } from "@/lib/roles";

const DOMAIN = "edusentrix.app";

export type AllocateSyntheticTestEmailRole = InvitationRole | "teacher" | "student";

function localPartPrefix(role: AllocateSyntheticTestEmailRole): string {
  switch (role) {
    case "teacher":
      return "testteacher";
    case "parent":
      return "testparent";
    case "bursar":
      return "testbursar";
    case "staff":
      return "teststaff";
    case "school_admin":
      return "testschooladmin";
    case "billing_owner":
      return "testbillingowner";
    case "student":
      return "teststudent";
    default:
      return "testuser";
  }
}

/**
 * Next sequential synthetic email for this school, e.g. `testteacher3@edusentrix.app`.
 */
export async function allocateSyntheticTestEmail(
  schoolId: mongoose.Types.ObjectId,
  role: AllocateSyntheticTestEmailRole
): Promise<string> {
  const prefix = localPartPrefix(role);
  const escapedDomain = DOMAIN.replace(/\./g, "\\.");
  const re = new RegExp(`^${prefix}(\\d+)@${escapedDomain}$`, "i");

  const emails = await User.find({ schoolId })
    .select("email")
    .lean<{ email: string }[]>();

  let max = 0;
  for (const row of emails) {
    const m = row.email?.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n)) max = Math.max(max, n);
    }
  }

  return `${prefix}${max + 1}@${DOMAIN}`;
}
