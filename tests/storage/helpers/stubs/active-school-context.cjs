// Test-only replacement for @/lib/auth/active-school-context.
// Reads the result a test placed on globalThis.__storageActiveSchool:
//   undefined            -> signed out
//   { throwStatus: 403 } -> throws a Response, like a suspended school
//   anything else        -> returned as the resolver result
async function resolveActiveSchoolContext() {
  const state = globalThis.__storageActiveSchool;
  if (!state) return { ok: false, reason: "unauthorized" };
  if (state.throwStatus) {
    throw new Response(JSON.stringify({ code: "SCHOOL_SUSPENDED" }), { status: state.throwStatus });
  }
  return state;
}

module.exports = { resolveActiveSchoolContext };
