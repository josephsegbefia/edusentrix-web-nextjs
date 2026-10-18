async function resolveActiveSchoolContext() {
  const state = globalThis.__assessmentRouteActiveSchool;
  if (!state) return { ok: false, reason: "unauthorized" };
  return state;
}

module.exports = { resolveActiveSchoolContext };
