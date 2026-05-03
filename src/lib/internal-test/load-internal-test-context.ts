import "server-only";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import type { IInternalTestSchoolConfig } from "@/models/InternalTestSchoolConfig";
import type { ISchool } from "@/models/School";
import { InternalTestSchoolConfig } from "@/models/InternalTestSchoolConfig";
import { School } from "@/models/School";

export type SchoolInternalTestSnapshot = {
  school: Pick<ISchool, "isInternalTestSchool" | "environmentType">;
  config: Pick<
    IInternalTestSchoolConfig,
    | "suppressEmailInvitations"
    | "autoActivateCreatedUsers"
    | "markEmailsAsVerified"
    | "suppressSms"
    | "suppressWhatsapp"
    | "suppressPushNotifications"
    | "suppressParentNotifications"
    | "useSandboxPayments"
    | "disableRealPaymentCollection"
  > | null;
};

export async function loadSchoolInternalTestSnapshot(
  schoolId: mongoose.Types.ObjectId
): Promise<SchoolInternalTestSnapshot | null> {
  await connectToDatabase();
  const [school, config] = await Promise.all([
    School.findById(schoolId)
      .select("isInternalTestSchool environmentType")
      .lean<Pick<ISchool, "isInternalTestSchool" | "environmentType"> | null>(),
    InternalTestSchoolConfig.findOne({ schoolId })
      .select(
        "suppressEmailInvitations autoActivateCreatedUsers markEmailsAsVerified suppressSms suppressWhatsapp suppressPushNotifications suppressParentNotifications useSandboxPayments disableRealPaymentCollection"
      )
      .lean<IInternalTestSchoolConfig | null>(),
  ]);

  if (!school) return null;

  return {
    school: {
      isInternalTestSchool: Boolean(school.isInternalTestSchool),
      environmentType: school.environmentType ?? "production",
    },
    config: config
      ? {
          suppressEmailInvitations: config.suppressEmailInvitations,
          autoActivateCreatedUsers: config.autoActivateCreatedUsers,
          markEmailsAsVerified: config.markEmailsAsVerified,
          suppressSms: config.suppressSms,
          suppressWhatsapp: config.suppressWhatsapp,
          suppressPushNotifications: config.suppressPushNotifications,
          suppressParentNotifications: config.suppressParentNotifications,
          useSandboxPayments: config.useSandboxPayments,
          disableRealPaymentCollection: config.disableRealPaymentCollection,
        }
      : null,
  };
}
