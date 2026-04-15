// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ─── Demo host detection (lightweight — no DB calls in middleware) ───
function isDemoHostMiddleware(req: NextRequest): boolean {
  const baseUrl = process.env.DEMO_BASE_URL ?? "";
  if (!baseUrl) return false;
  try {
    const expected = new URL(
      baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`
    ).hostname.toLowerCase();
    const incoming =
      (req.headers.get("host") ?? req.headers.get("x-forwarded-host") ?? "")
        .split(":")[0]
        ?.toLowerCase()
        .trim() ?? "";
    return incoming === expected;
  } catch {
    return false;
  }
}

const DEMO_SESSION_COOKIE = "edusentrix_demo_session";
const DEMO_PUBLIC_PREFIXES = [
  "/api/demo/",
  "/favicon.ico",
  "/_next",
  "/api/banks/search",
];

// Define public routes (everything else is protected)
const isPublicRoute = createRouteMatcher([
  "/", // landing/marketing
  "/enroll", // enrollment form
  "/auth/callback", // our centralized router after login
  "/favicon.ico",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/banks/search",
  "/api/uploadthing(.*)", // UploadThing callback + handshake endpoints
  "/api/webhooks/brevo(.*)", // Brevo outbound event + inbound parse webhooks
  "/api/cron(.*)", // Cron jobs authenticate with their own secrets
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // ─── Demo host: skip Clerk, use demo session cookie ───
  if (isDemoHostMiddleware(req)) {
    const pathname = req.nextUrl.pathname;
    const hasDemoCookie = !!req.cookies.get(DEMO_SESSION_COOKIE)?.value;
    const isDemoPublic =
      pathname === "/" ||
      DEMO_PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

    if (hasDemoCookie || isDemoPublic) {
      const res = NextResponse.next();
      res.headers.set("X-Robots-Tag", "noindex");
      return res;
    }

    return NextResponse.redirect(new URL("/", req.url));
  }

  // ─── Production / development host: existing Clerk flow ───
  // Allow POST to /api/platform/applications (public enrollment form)
  if (
    req.method === "POST" &&
    req.nextUrl.pathname === "/api/platform/applications"
  ) {
    return; // Allow through without auth
  }

  const { userId } = await auth();
  const pathname = req.nextUrl.pathname;

  // Allow all public routes to pass
  const isPublic =
    isPublicRoute(req) ||
    [
      "/",
      "/sign-in",
      "/sign-up",
      "/auth/callback",
      "/favicon.ico",
      "/api/banks/search",
      "/api/uploadthing",
      "/api/webhooks/brevo",
    ].some((p) => pathname === p || pathname.startsWith(p));

  if (!userId) {
    // Unauthed users can hit public routes; Clerk will handle the rest.
    if (!isPublic) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
    return;
  }

  // If already on password page, allow
  if (pathname.startsWith("/account/set-password")) return;

  // Password factor check (fast Clerk lookup)
  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const needsPassword = !user.passwordEnabled;

    // Force password creation if missing (but let public routes pass)
    if (needsPassword && !isPublic) {
      const redirect = new URL("/account/set-password", req.url);
      return NextResponse.redirect(redirect);
    }
  } catch (error) {
    // If Clerk lookup fails, log but don't block
    console.error("Middleware - Clerk user lookup failed:", error);
  }

  // Otherwise proceed
  return;
});

export const config = {
  matcher: [
    // Run on all routes, except Next internals
    "/((?!.+\\.[\\w]+$|_next).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
};
