// Test-only replacement for @/lib/auth/active-school-context (no Clerk, no cookies).
const ACTIVE_SCHOOL_COOKIE = "edusentrix_active_school";

async function resolveActiveSchoolContext() {
  const session = globalThis.__approvalTestSession;
  if (!session) return { ok: false, reason: "unauthorized" };
  if (session.needsSchoolSelection) return { ok: false, reason: "needs_school_selection" };
  return {
    ok: true,
    context: {
      userId: session.userId,
      schoolId: session.schoolId,
      roles: session.roles,
      source: "single_membership",
    },
  };
}

function activeSchoolCookieOptions() {
  return {};
}
async function readActiveSchoolCookie() {
  return null;
}
async function setActiveSchoolCookie() {}
async function clearActiveSchoolCookie() {}

module.exports = {
  ACTIVE_SCHOOL_COOKIE,
  resolveActiveSchoolContext,
  activeSchoolCookieOptions,
  readActiveSchoolCookie,
  setActiveSchoolCookie,
  clearActiveSchoolCookie,
};
