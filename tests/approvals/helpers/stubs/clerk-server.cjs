// Test-only replacement for @clerk/nextjs/server. A signed-in test session has a Clerk id.
async function auth() {
  const session = globalThis.__approvalTestSession;
  return { userId: session ? "user_test_clerk" : null };
}
async function currentUser() {
  return null;
}
async function clerkClient() {
  throw new Error("clerkClient is not available in approval route tests");
}
function clerkMiddleware() {
  throw new Error("clerkMiddleware is not available in approval route tests");
}
function createRouteMatcher() {
  return () => false;
}

module.exports = { auth, currentUser, clerkClient, clerkMiddleware, createRouteMatcher };
