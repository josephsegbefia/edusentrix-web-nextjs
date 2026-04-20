// src/lib/auth/generateOnboardingMagicLink.ts
import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import {
  getInvitationAcceptUrl,
  getInvitationRedirectUrl,
} from "@/lib/utils/getAppUrl";

/**
 * Generate a magic link for onboarding a new user
 * Creates a Clerk invitation which sends a magic link email to the user
 * Returns the Clerk invitation acceptance URL where the user can complete onboarding
 */
export async function generateOnboardingMagicLink(email: string): Promise<string> {
  const redirectUrl = getInvitationRedirectUrl();

  const clerk = await clerkClient();

  // Create an invitation which will send a magic link email to the user
  const invitation = await clerk.invitations.createInvitation({
    emailAddress: email.toLowerCase().trim(),
    redirectUrl,
    notify: false,
    ignoreExisting: true,
  });

  // Return the invitation acceptance URL with Clerk ticket parameters.
  return getInvitationAcceptUrl(invitation, redirectUrl);
}
