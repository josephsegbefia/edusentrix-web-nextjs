import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define public routes (everything else is protected)
const isPublicRoute = createRouteMatcher([
  "/", // landing/marketing
  "/enroll", // enrollment form
  "/auth/callback", // our centralized router after login
  "/favicon.ico",
  "/sign-in(.*)",
  "/sign-up(.*)",
  // public APIs (adjust to your needs)
  "/api/platform/applications", // GET public list if you allow
  "/api/banks/search", // if public
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    // Protect all non-public routes
    await auth();
  }
});

// This matcher keeps Next.js routing happy, protecting app & api (not assets)
export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api)(.*)"],
};
