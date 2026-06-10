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
  "/about",
  "/contact",
  "/terms",
  "/privacy",
  "/enroll",
  "/legal/",
  "/api/account/legal-acceptance",
  "/api/public/contact",
  "/api/demo/",
  "/favicon.ico",
  "/_next",
  "/api/banks/search",
  "/upload/parent-document",
  "/api/public/students/parent-documents",
];

// Define public routes (everything else is protected)
const isPublicRoute = createRouteMatcher([
  "/", // landing/marketing
  "/about",
  "/contact",
  "/terms",
  "/privacy",
  "/enroll", // enrollment form
  "/legal/(.*)", // legal acceptance gate — reachable without password check
  "/apply(.*)", // public school admission application + tracker pages
  "/upload/parent-document(.*)", // tokenized guardian upload (not under /parent — avoids parent app layout)
  "/auth/callback", // our centralized router after login
  "/favicon.ico",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/auth/dev-teacher-login",
  "/api/banks/search",
  "/api/public/contact",
  "/api/public/admissions(.*)", // public admission application APIs
  "/api/public/students/parent-documents(.*)", // public parent document upload APIs
  "/api/uploadthing(.*)", // UploadThing callback + handshake endpoints
  "/api/webhooks/brevo(.*)", // Brevo outbound event + inbound parse webhooks
  "/api/cron(.*)", // Cron jobs authenticate with their own secrets
  // Secret URL + OTP-gated first platform admin bootstrap (see PLATFORM_ADMIN_BOOTSTRAP_SECRET)
  "/platform-bootstrap(.*)",
  "/api/platform/bootstrap(.*)",
  "/api/account/legal-acceptance",
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Legacy / mis-placed URL: was under /parent/* which uses the authenticated
  // parent app layout. Public uploads live under /upload/parent-document/* only.
  const pathname = req.nextUrl.pathname;
  if (
    pathname.startsWith("/parent/upload-document/") &&
    pathname.length > "/parent/upload-document/".length
  ) {
    const token = pathname.slice("/parent/upload-document/".length);
    const url = req.nextUrl.clone();
    url.pathname = `/upload/parent-document/${token}`;
    return NextResponse.redirect(url);
  }

  // ─── Demo host: skip Clerk entirely, use demo session cookie ───
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

    // No demo session — send back to the demo landing form.
    // Append the original path so the form can redirect after creation.
    const redirect = new URL("/", req.url);
    redirect.searchParams.set("next", pathname);
    return NextResponse.redirect(redirect);
  }

  // ─── Production / development host: existing Clerk flow ───
  // Allow POST to /api/platform/applications (public enrollment form)
  if (
    req.method === "POST" &&
    req.nextUrl.pathname === "/api/platform/applications"
  ) {
    return; // Allow through without auth
  }

  // Allow all public routes to pass before touching Clerk auth. This is
  // especially important for UploadThing callbacks/handshakes and webhooks.
  const isPublic =
    isPublicRoute(req) ||
    [
      "/",
      "/sign-in",
      "/sign-up",
      "/api/auth/dev-teacher-login",
      "/about",
      "/contact",
      "/terms",
      "/privacy",
      "/legal/",
      "/apply",
      "/auth/callback",
      "/favicon.ico",
      "/api/banks/search",
      "/api/public/contact",
      "/api/public/admissions",
      "/api/public/students/parent-documents",
      "/upload/parent-document",
      "/api/uploadthing",
      "/api/webhooks/brevo",
      "/api/account/legal-acceptance",
      "/platform-bootstrap",
      "/api/platform/bootstrap",
    ].some((p) => pathname === p || pathname.startsWith(p));

  if (isPublic) {
    return;
  }

  const { userId } = await auth();

  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  // If already on password page, allow
  if (pathname.startsWith("/account/set-password")) return;

  // Password factor check (fast Clerk lookup)
  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const needsPassword = !user.passwordEnabled;

    if (needsPassword) {
      const redirect = new URL("/account/set-password", req.url);
      return NextResponse.redirect(redirect);
    }
  } catch (error) {
    console.error("Middleware - Clerk user lookup failed:", error);
  }

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
