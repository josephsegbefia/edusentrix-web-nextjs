import "server-only";

import { connectToDatabase } from "@/db/connectToDatabase";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { School } from "@/models/School";
import { DELEGATION_REGISTRY } from "@/lib/delegations/registry";
import type { DelegationModule } from "@/lib/delegations/types";
import mongoose from "mongoose";
import { sendTrackedBrevoEmail } from "@/lib/email";
import { stripHtml } from "@/lib/email/branded-template";
import { getAppUrl } from "@/lib/utils/getAppUrl";

function presetLabel(module: DelegationModule, preset: string): string {
  const def = DELEGATION_REGISTRY[module];
  return def?.presets[preset]?.label ?? preset;
}

async function loadSchoolBrand(schoolId: mongoose.Types.ObjectId) {
  const school = await School.findById(schoolId)
    .select({ name: 1, logo: 1 })
    .lean<{ name?: string; logo?: string } | null>();
  return {
    schoolName: school?.name ?? null,
    schoolLogo: school?.logo ?? null,
  };
}

async function loadStaffEmail(staffUserId: mongoose.Types.ObjectId) {
  const u = await User.findById(staffUserId)
    .select({ email: 1, firstName: 1 })
    .lean<{ email?: string; firstName?: string } | null>();
  const email = u?.email?.trim();
  if (!email) return null;
  return { email, firstName: u?.firstName };
}

async function sendDelegationLifecycleEmail(input: {
  schoolId: mongoose.Types.ObjectId;
  staffUserId: mongoose.Types.ObjectId;
  subject: string;
  innerHtml: string;
  schoolName: string | null;
  schoolLogo: string | null;
}): Promise<void> {
  const staff = await loadStaffEmail(input.staffUserId);
  if (!staff) return;

  const htmlContent = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#0f172a">${input.innerHtml}</div>`;
  const textContent = stripHtml(htmlContent);

  try {
    await sendTrackedBrevoEmail({
      to: staff.email,
      toName: staff.firstName ?? null,
      subject: input.subject,
      htmlContent,
      textContent,
      templateKey: "DELEGATION_ACCESS_LIFECYCLE",
      schoolId: String(input.schoolId),
      schoolName: input.schoolName,
      schoolLogo: input.schoolLogo,
      recipientUserId: String(input.staffUserId),
      recipientRole: "staff",
    });
  } catch (e) {
    console.error("sendDelegationLifecycleEmail failed:", e);
  }
}

export async function notifyDelegateAccessGranted(input: {
  schoolId: mongoose.Types.ObjectId;
  staffUserId: mongoose.Types.ObjectId;
  module: DelegationModule;
  preset: string;
  expiresAt: Date | null;
  schoolName?: string;
}): Promise<void> {
  try {
    await connectToDatabase();
    const mod = DELEGATION_REGISTRY[input.module];
    const moduleLabel = mod?.label ?? input.module;
    const level = presetLabel(input.module, input.preset);
    const school = input.schoolName?.trim() || "your school";
    const expiry =
      input.expiresAt != null
        ? ` Access expires ${input.expiresAt.toLocaleDateString()}.`
        : " Access stays active until an admin revokes it.";
    const href = mod?.delegateHref ?? "/teacher";
    const appUrl = getAppUrl();
    const openUrl = href.startsWith("http") ? href : `${appUrl}${href.startsWith("/") ? href : `/${href}`}`;

    await Notification.create({
      schoolId: input.schoolId,
      userId: input.staffUserId,
      type: "system",
      title: "Delegated access granted",
      body: `You have been given ${level} access to ${moduleLabel} for ${school}.${expiry}`,
      isRead: false,
      priority: "normal",
      actionUrl: href,
      metadata: { module: input.module, preset: input.preset, kind: "delegation_granted" },
    });

    const brand = await loadSchoolBrand(input.schoolId);
    const schoolLabel = input.schoolName?.trim() || brand.schoolName || "your school";
    await sendDelegationLifecycleEmail({
      schoolId: input.schoolId,
      staffUserId: input.staffUserId,
      subject: `Delegated access: ${moduleLabel}`,
      schoolName: brand.schoolName,
      schoolLogo: brand.schoolLogo,
      innerHtml: `<p>Hello,</p><p>You have been given <strong>${level}</strong> access to <strong>${moduleLabel}</strong> for <strong>${schoolLabel}</strong>.${expiry}</p><p><a href="${openUrl}" style="color:#4f46e5;">Open module</a></p>`,
    });
  } catch (e) {
    console.error("notifyDelegateAccessGranted failed:", e);
  }
}

export async function notifyDelegateAccessUpdated(input: {
  schoolId: mongoose.Types.ObjectId;
  staffUserId: mongoose.Types.ObjectId;
  module: DelegationModule;
  preset: string;
  expiresAt: Date | null;
  schoolName?: string;
}): Promise<void> {
  try {
    await connectToDatabase();
    const mod = DELEGATION_REGISTRY[input.module];
    const moduleLabel = mod?.label ?? input.module;
    const level = presetLabel(input.module, input.preset);
    const school = input.schoolName?.trim() || "your school";
    const expiry =
      input.expiresAt != null
        ? ` Access now expires ${input.expiresAt.toLocaleDateString()}.`
        : " Access stays active until an admin revokes it.";
    const href = mod?.delegateHref ?? "/teacher";

    await Notification.create({
      schoolId: input.schoolId,
      userId: input.staffUserId,
      type: "system",
      title: "Delegated access updated",
      body: `Your ${moduleLabel} access is now ${level} for ${school}.${expiry}`,
      isRead: false,
      priority: "normal",
      actionUrl: href,
      metadata: { module: input.module, preset: input.preset, kind: "delegation_updated" },
    });

    const brand = await loadSchoolBrand(input.schoolId);
    const schoolLabel = input.schoolName?.trim() || brand.schoolName || "your school";
    const appUrl = getAppUrl();
    const openUrl = href.startsWith("http") ? href : `${appUrl}${href.startsWith("/") ? href : `/${href}`}`;
    await sendDelegationLifecycleEmail({
      schoolId: input.schoolId,
      staffUserId: input.staffUserId,
      subject: `Delegated access updated: ${moduleLabel}`,
      schoolName: brand.schoolName,
      schoolLogo: brand.schoolLogo,
      innerHtml: `<p>Hello,</p><p>Your access to <strong>${moduleLabel}</strong> for <strong>${schoolLabel}</strong> was updated. You now have <strong>${level}</strong> access.${expiry}</p><p><a href="${openUrl}" style="color:#4f46e5;">Open module</a></p>`,
    });
  } catch (e) {
    console.error("notifyDelegateAccessUpdated failed:", e);
  }
}

export async function notifyDelegateAccessRevoked(input: {
  schoolId: mongoose.Types.ObjectId;
  staffUserId: mongoose.Types.ObjectId;
  module: DelegationModule;
  schoolName?: string;
}): Promise<void> {
  try {
    await connectToDatabase();
    const mod = DELEGATION_REGISTRY[input.module];
    const moduleLabel = mod?.label ?? input.module;
    const school = input.schoolName?.trim() || "your school";

    await Notification.create({
      schoolId: input.schoolId,
      userId: input.staffUserId,
      type: "system",
      title: "Delegated access removed",
      body: `Your delegated access to ${moduleLabel} for ${school} has been revoked.`,
      isRead: false,
      priority: "normal",
      metadata: { module: input.module, kind: "delegation_revoked" },
    });

    const brand = await loadSchoolBrand(input.schoolId);
    const schoolLabel = input.schoolName?.trim() || brand.schoolName || "your school";
    await sendDelegationLifecycleEmail({
      schoolId: input.schoolId,
      staffUserId: input.staffUserId,
      subject: `Delegated access removed: ${moduleLabel}`,
      schoolName: brand.schoolName,
      schoolLogo: brand.schoolLogo,
      innerHtml: `<p>Hello,</p><p>Your delegated access to <strong>${moduleLabel}</strong> for <strong>${schoolLabel}</strong> has been revoked.</p>`,
    });
  } catch (e) {
    console.error("notifyDelegateAccessRevoked failed:", e);
  }
}

export async function notifyDelegationExpiryReminder(input: {
  schoolId: mongoose.Types.ObjectId;
  staffUserId: mongoose.Types.ObjectId;
  delegationId: mongoose.Types.ObjectId;
  module: DelegationModule;
  expiresAt: Date;
  schoolName?: string;
}): Promise<void> {
  try {
    await connectToDatabase();
    const mod = DELEGATION_REGISTRY[input.module];
    const moduleLabel = mod?.label ?? input.module;
    const school = input.schoolName?.trim() || "your school";
    const when = input.expiresAt.toLocaleDateString();
    const href = mod?.delegateHref ?? "/teacher";

    await Notification.create({
      schoolId: input.schoolId,
      userId: input.staffUserId,
      type: "system",
      title: "Delegated access expiring soon",
      body: `Your ${moduleLabel} access for ${school} expires on ${when}. Ask an admin to extend it if needed.`,
      isRead: false,
      priority: "normal",
      actionUrl: href,
      metadata: {
        module: input.module,
        kind: "delegation_expiry_reminder",
        delegationId: String(input.delegationId),
      },
    });

    const brand = await loadSchoolBrand(input.schoolId);
    const schoolLabel = input.schoolName?.trim() || brand.schoolName || "your school";
    const appUrl = getAppUrl();
    const openUrl = href.startsWith("http") ? href : `${appUrl}${href.startsWith("/") ? href : `/${href}`}`;
    await sendDelegationLifecycleEmail({
      schoolId: input.schoolId,
      staffUserId: input.staffUserId,
      subject: `Reminder: delegated access expires ${when}`,
      schoolName: brand.schoolName,
      schoolLogo: brand.schoolLogo,
      innerHtml: `<p>Hello,</p><p>Your delegated access to <strong>${moduleLabel}</strong> for <strong>${schoolLabel}</strong> expires on <strong>${when}</strong>. Contact your school admin if you need an extension.</p><p><a href="${openUrl}" style="color:#4f46e5;">Open module</a></p>`,
    });
  } catch (e) {
    console.error("notifyDelegationExpiryReminder failed:", e);
  }
}
