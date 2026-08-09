// src/lib/utils/getAppUrl.ts
/**
 * Get the application URL for redirects, verification links, etc.
 * Priority:
 * 1. APP_URL (explicit override)
 * 2. NEXT_PUBLIC_APP_URL (explicit override)
 * 3. VERCEL_PROJECT_PRODUCTION_URL
 * 4. VERCEL_URL
 * 5. Production fallback: https://tryedusentrix.app
 * 6. Development: http://localhost:3000 (or PORT)
 */
export function getAppUrl(): string {
  const appUrl = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (appUrl) {
    return appUrl;
  }

  const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (publicAppUrl) {
    return publicAppUrl;
  }

  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ?.trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (vercelProductionUrl) {
    return `https://${vercelProductionUrl}`;
  }

  const vercelUrl = process.env.VERCEL_URL
    ?.trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  const isProduction =
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production";
  if (isProduction) {
    return "https://tryedusentrix.app";
  }

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

export function withInvitedEmail(url: string, invitedEmail?: string | null): string {
  const normalizedEmail = invitedEmail?.trim();
  if (!normalizedEmail) return url;

  try {
    const parsed = new URL(url);
    parsed.searchParams.set("invited_email", normalizedEmail);
    return parsed.toString();
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}invited_email=${encodeURIComponent(normalizedEmail)}`;
  }
}

export function getInvitationAcceptUrl(
  invitation:
    | { url?: string | null; emailAddress?: string | null }
    | null
    | undefined,
  fallbackUrl?: string | null,
  explicitInvitedEmail?: string | null
): string {
  const invitedEmail =
    explicitInvitedEmail?.trim() || invitation?.emailAddress?.trim();
  const acceptUrl = invitation?.url?.trim();
  const url = acceptUrl || fallbackUrl || getInvitationRedirectUrl();
  return withInvitedEmail(url, invitedEmail);
}
