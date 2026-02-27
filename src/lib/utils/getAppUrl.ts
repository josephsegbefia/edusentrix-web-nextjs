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
 * Get the Clerk redirect URL for invitation callbacks
 */
export function getInvitationRedirectUrl(): string {
  return `${getAppUrl()}/auth/callback`;
}
