import "server-only";

import { clerkClient } from "@clerk/nextjs/server";

export type CreatedClerkInvitation = {
  id: string;
  url?: string | null;
  emailAddress?: string | null;
};

export async function createClerkInvitation(input: {
  email: string;
  redirectUrl: string;
  publicMetadata: Record<string, unknown>;
}): Promise<CreatedClerkInvitation> {
  const clerk = await clerkClient();
  const invitation = await clerk.invitations.createInvitation({
    emailAddress: input.email,
    redirectUrl: input.redirectUrl,
    notify: false,
    publicMetadata: input.publicMetadata,
    ignoreExisting: true,
  });

  return {
    id: invitation.id,
    url: invitation.url,
    emailAddress: invitation.emailAddress,
  };
}

export const clerkInvitationPort = {
  create: createClerkInvitation,
};
