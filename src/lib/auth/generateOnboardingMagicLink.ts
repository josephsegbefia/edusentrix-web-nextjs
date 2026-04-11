// src/lib/auth/generateOnboardingMagicLink.ts
import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { getAppUrl, getInvitationRedirectUrl } from "@/lib/utils/getAppUrl";

/**
 * Generate a magic link for onboarding a new user
 * Creates a Clerk invitation which sends a magic link email to the user
 * Returns the sign-in URL where the user can complete onboarding
 */
export async function generateOnboardingMagicLink(email: string): Promise<string> {
  const APP_URL = getAppUrl();
  const redirectUrl = getInvitationRedirectUrl();

  const clerk = await clerkClient();

  // Create an invitation which will send a magic link email to the user
  await clerk.invitations.createInvitation({
    emailAddress: email.toLowerCase().trim(),
    redirectUrl,
    notify: false,
    ignoreExisting: true,
  });

  // Return the sign-in URL - Clerk will send the magic link via email
  // The user clicks the link in their email to complete sign-in
  return `${APP_URL}/sign-in`;
}
