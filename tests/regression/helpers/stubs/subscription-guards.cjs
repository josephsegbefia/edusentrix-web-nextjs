// Test-only replacement for @/lib/subscriptions/guards: every feature allowed.
async function requireSchoolFeature() {
  return { allowed: true };
}

module.exports = { requireSchoolFeature };
