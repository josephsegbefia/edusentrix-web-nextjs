// src/lib/utils/getBaseUrl.ts
/**
 * Get the base URL for the application.
 * Handles different environments: development, preview, and production.
 * 
 * Priority:
 * 1. NEXT_PUBLIC_APP_URL (explicit override)
 * 2. VERCEL_PROJECT_PRODUCTION_URL (Vercel production)
 * 3. VERCEL_URL (Vercel preview/branch deployments)
 * 4. APP_URL (legacy)
 * 5. localhost fallback
 */
export function getBaseUrl(): string {
  // Explicit override takes priority
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  // Vercel production URL (e.g., your-project.vercel.app or custom domain)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  // Vercel preview/branch deployment URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Legacy APP_URL
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, "");
  }

  // Fallback for local development
  return "http://localhost:3000";
}

/**
 * Get the base URL from request headers (for API routes).
 * Falls back to getBaseUrl() if headers aren't available.
 */
export function getBaseUrlFromRequest(headers: Headers): string {
  // Check for forwarded host (behind proxy/load balancer)
  const forwardedHost = headers.get("x-forwarded-host");
  const forwardedProto = headers.get("x-forwarded-proto") || "https";
  
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  // Check for host header
  const host = headers.get("host");
  if (host) {
    const protocol = host.includes("localhost") ? "http" : "https";
    return `${protocol}://${host}`;
  }

  // Fallback to environment-based URL
  return getBaseUrl();
}
