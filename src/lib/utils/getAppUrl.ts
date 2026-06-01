// src/lib/utils/getAppUrl.ts
/**
 * Get the application URL for redirects, verification links, etc.
 * Priority:
 * 1. APP_URL (explicit override)
 * 2. NEXT_PUBLIC_APP_URL (explicit override)
 * 3. Production: https://tryedusentrix.app
 * 4. Development: http://localhost:3000 (or PORT)
 */
export function getAppUrl(): string {
  // Explicit overrides take priority
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Production: use tryedusentrix.app
  const isProduction =
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production";
  if (isProduction) {
    return "https://tryedusentrix.app";
  }

  // Development: localhost
  const port = process.env.PORT || "3000";
  return `http://localhost:${port}`;
}

/**
 * URL Clerk redirects to **after the user clicks an invitation link**, with
 * `__clerk_ticket` (and optionally `__clerk_status`) appended.
 *
 * Must be a page that can **complete sign-up without an existing session** — not
 * `/auth/callback`, which immediately redirects unauthenticated users to sign-in
 * and drops the ticket (Clerk: "non-existing identification" / broken Continue).
 */
export function getInvitationRedirectUrl(): string {
  return `${getAppUrl()}/sign-up`;
}

export function getInvitationAcceptUrl(
  invitation:
    | { url?: string | null; emailAddress?: string | null }
    | null
    | undefined,
  fallbackUrl?: string | null
): string {
  const invitedEmail = invitation?.emailAddress?.trim();
  const acceptUrl = invitation?.url?.trim();
  const url = acceptUrl || fallbackUrl || getInvitationRedirectUrl();
  if (!invitedEmail) return url;

  try {
    const parsed = new URL(url);
    parsed.searchParams.set("invited_email", invitedEmail);
    return parsed.toString();
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}invited_email=${encodeURIComponent(invitedEmail)}`;
  }
}
