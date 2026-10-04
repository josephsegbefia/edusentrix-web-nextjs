// Test-only replacement for @/lib/delegations/requireDelegatedModulePermission.
// Only GET handlers use it; the invoice-numbering tests exercise POST only.
async function requireFinanceStaffOrDelegatedModuleView() {
  throw new Error("not available in invoice-numbering tests");
}

module.exports = { requireFinanceStaffOrDelegatedModuleView };
