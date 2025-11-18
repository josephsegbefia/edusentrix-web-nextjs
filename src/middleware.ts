import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Define public routes (everything else is protected)
const isPublicRoute = createRouteMatcher([
  "/", // landing/marketing
  "/enroll", // enrollment form
  "/auth/callback", // our centralized router after login
  "/favicon.ico",
  "/sign-in(.*)",
  "/sign-up(.*)",
  // public APIs (adjust to your needs)
  // GET public list if you allow
  "/api/banks/search",
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Centralized guard: if no session and route not public -> go to sign in
  const { userId } = await auth();
  if (!userId && !isPublicRoute(req)) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }
});

// This matcher keeps Next.js routing happy, protecting app & api (not assets)
export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api)(.*)"],
};
