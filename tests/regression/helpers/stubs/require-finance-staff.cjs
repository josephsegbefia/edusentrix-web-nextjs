// Test-only replacement for @/lib/auth/requireFinanceStaff (no Clerk).
// The context is read synchronously when the route calls it, so tests set
// globalThis.__financeRouteTestContext immediately before invoking a handler.
async function requireFinanceStaff() {
  const ctx = globalThis.__financeRouteTestContext;
  if (!ctx) throw new Error("finance route test context not set");
  return { schoolId: ctx.schoolId, userId: ctx.userId };
}

module.exports = { requireFinanceStaff };
