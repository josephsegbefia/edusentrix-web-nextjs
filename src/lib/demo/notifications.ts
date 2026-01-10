// src/lib/demo/notifications.ts
// Demo sales notifications via email

import "server-only";
import { sendEmail } from "@/lib/email/brevo";
import { DEMO_SALES_EMAILS } from "./config";
import type { DemoLeadDTO, DemoSessionDTO } from "@/types/demo";

/**
 * Format school size for display
 */
function formatSchoolSize(size?: string): string | undefined {
  const sizes: Record<string, string> = {
    small: "< 100 students",
    medium: "100-500 students",
    large: "500-1000 students",
    xlarge: "1000+ students",
  };
  return size ? sizes[size] : undefined;
}

/**
 * Format duration for display
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

/**
 * Notify sales team of new demo signup
 */
export async function notifyNewDemoSignup(lead: DemoLeadDTO): Promise<void> {
  if (DEMO_SALES_EMAILS.length === 0) {
    console.log("[Demo] No sales emails configured, skipping notification");
    return;
  }

  try {
    const recipients = DEMO_SALES_EMAILS.map((email) => ({ email }));
    await sendEmail(recipients, "DEMO_SALES_NOTIFICATION", {
      leadName: lead.fullName,
      leadEmail: lead.email,
      organization: lead.organization,
      role: lead.role,
      schoolSize: formatSchoolSize(lead.schoolSize),
      country: lead.country,
      timestamp: new Date().toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    });
    console.log(`[Demo] Sales notification sent for ${lead.email}`);
  } catch (error) {
    console.error("[Demo] Failed to send sales notification:", error);
    // Don't throw - notification failure shouldn't break demo flow
  }
}

/**
 * Alert sales team of high-intent signals
 */
export async function notifyHighIntent(
  lead: DemoLeadDTO,
  session: DemoSessionDTO,
  signals: string[]
): Promise<void> {
  if (DEMO_SALES_EMAILS.length === 0) return;

  try {
    const recipients = DEMO_SALES_EMAILS.map((email) => ({ email }));
    await sendEmail(recipients, "DEMO_HIGH_INTENT_ALERT", {
      leadName: lead.fullName,
      leadEmail: lead.email,
      organization: lead.organization,
      signals,
      timeInDemo: formatDuration(session.durationSeconds),
      featuresViewed: lead.featuresExplored,
    });
    console.log(`[Demo] High intent alert sent for ${lead.email}`);
  } catch (error) {
    console.error("[Demo] Failed to send high intent alert:", error);
  }
}

/**
 * Notify sales when demo session ends
 */
export async function notifySessionEnded(
  lead: DemoLeadDTO,
  session: DemoSessionDTO
): Promise<void> {
  if (DEMO_SALES_EMAILS.length === 0) return;

  try {
    const recipients = DEMO_SALES_EMAILS.map((email) => ({ email }));
    await sendEmail(recipients, "DEMO_SESSION_ENDED", {
      leadName: lead.fullName,
      leadEmail: lead.email,
      organization: lead.organization,
      duration: formatDuration(session.durationSeconds),
      pagesVisited: session.pagesVisited,
      actionsAttempted: session.actionsAttempted,
    });
    console.log(`[Demo] Session ended notification sent for ${lead.email}`);
  } catch (error) {
    console.error("[Demo] Failed to send session ended notification:", error);
  }
}

/**
 * Send magic link to demo user
 */
export async function sendDemoMagicLink(
  email: string,
  name: string,
  magicLink: string
): Promise<void> {
  const expiresInMinutes = 60; // 1 hour

  await sendEmail(email, "DEMO_MAGIC_LINK", {
    name,
    magicLink,
    expiresInMinutes,
  });

  console.log(`[Demo] Magic link sent to ${email}`);
}
