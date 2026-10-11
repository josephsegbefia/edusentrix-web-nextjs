// Test-only replacement for @/lib/platform/assisted-access/session: no assisted access.
const ASSISTED_ACCESS_COOKIE = "edusentrix_assisted_access";

async function getActiveAssistedAccessSession() {
  return null;
}
function assistedAccessCookieOptions() {
  return {};
}
function setAssistedAccessCookie() {}
function clearAssistedAccessCookie() {}

module.exports = {
  ASSISTED_ACCESS_COOKIE,
  getActiveAssistedAccessSession,
  assistedAccessCookieOptions,
  setAssistedAccessCookie,
  clearAssistedAccessCookie,
};
