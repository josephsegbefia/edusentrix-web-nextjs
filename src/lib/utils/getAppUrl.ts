// src/lib/utils/getAppUrl.ts
/**
 * Get the application URL for redirects.
 * Checks multiple environment variables in order of priority:
 * 1. APP_URL (explicit setting)
 * 2. NEXT_PUBLIC_APP_URL (client-accessible setting)
 * 3. VERCEL_URL (auto-set by Vercel)
 * 4. Fallback to localhost for development
 */
export function getAppUrl(): string {
  // Explicit APP_URL takes priority
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }

  // Client-accessible URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Vercel auto-sets this for deployments
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Development fallback
  return "http://localhost:3000";
}

/**
 * Get the Clerk redirect URL for invitation callbacks
 */
export function getInvitationRedirectUrl(): string {
  return `${getAppUrl()}/auth/callback`;
}
