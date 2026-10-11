// Test-only replacement for @/lib/demo/guard-integration: never a demo session.
async function tryResolveDemoGuard() {
  return { isDemo: false };
}

module.exports = { tryResolveDemoGuard };
