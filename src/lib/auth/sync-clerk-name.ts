import "server-only";

import { clerkClient } from "@clerk/nextjs/server";

function splitDisplayName(fullName: string | null | undefined) {
  const trimmed = (fullName || "").trim();
  if (!trimmed) return { firstName: "", lastName: "" };

  const parts = trimmed.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

export async function syncClerkNameFromAppUser(input: {
  clerkUserId: string;
  currentClerkFirstName?: string | null;
  currentClerkLastName?: string | null;
  appFirstName?: string | null;
  appLastName?: string | null;
  appDisplayName?: string | null;
}) {
  const fallback = splitDisplayName(input.appDisplayName);
  const targetFirstName = String(
    input.appFirstName || fallback.firstName || ""
  ).trim();
  const targetLastName = String(
    input.appLastName || fallback.lastName || ""
  ).trim();

  if (!targetFirstName && !targetLastName) return false;

  const currentFirstName = String(input.currentClerkFirstName || "").trim();
  const currentLastName = String(input.currentClerkLastName || "").trim();

  if (
    targetFirstName === currentFirstName &&
    targetLastName === currentLastName
  ) {
    return false;
  }

  const clerk = await clerkClient();
  await clerk.users.updateUser(input.clerkUserId, {
    firstName: targetFirstName || undefined,
    lastName: targetLastName || undefined,
  });
  return true;
}
