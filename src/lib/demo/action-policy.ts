import { isDemoMode } from "./runtime";

/**
 * Demo side-effect policy — controls what happens when the app would
 * normally call an external service.
 *
 * - `allow`    — call proceeds normally (used for reads)
 * - `simulate` — return a fake success without making the call
 * - `deny`     — throw or return a user-facing blocked-action message
 */
export type DemoActionDisposition = "allow" | "simulate" | "deny";

export type DemoActionPolicy = {
  service: string;
  action: string;
  disposition: DemoActionDisposition;
  simulatedResponse?: unknown;
  userMessage?: string;
};

const DEMO_POLICIES: DemoActionPolicy[] = [
  // ── Paystack ──────────────────────────────────────────────────────
  { service: "paystack", action: "listBanks",            disposition: "allow" },
  { service: "paystack", action: "resolveSettlementBank", disposition: "allow" },
  { service: "paystack", action: "verifyTransfer",        disposition: "allow" },
  { service: "paystack", action: "getKeyMode",            disposition: "allow" },
  { service: "paystack", action: "initializeTransaction", disposition: "simulate",
    simulatedResponse: { authorization_url: "#demo-checkout", access_code: "demo_access", reference: "demo_ref_" + Date.now() },
    userMessage: "Payment checkout is simulated in demo mode." },
  { service: "paystack", action: "createSubaccount",      disposition: "simulate",
    simulatedResponse: { subaccount_code: "DEMO_ACCT_001", id: 1 },
    userMessage: "Subaccount creation is simulated in demo mode." },
  { service: "paystack", action: "createTransferRecipient", disposition: "simulate",
    simulatedResponse: { recipient_code: "DEMO_RCP_001" },
    userMessage: "Transfer recipient creation is simulated in demo mode." },
  { service: "paystack", action: "initiateTransfer",      disposition: "deny",
    userMessage: "Real money transfers are disabled in demo mode." },

  // ── Email (Brevo) ────────────────────────────────────────────────
  { service: "email", action: "sendTransactional",        disposition: "simulate",
    simulatedResponse: { messageId: "demo-msg-id" },
    userMessage: "Email sending is simulated in demo mode." },
  { service: "email", action: "sendBulk",                 disposition: "simulate",
    simulatedResponse: { batchId: "demo-batch-id" },
    userMessage: "Bulk email is simulated in demo mode." },

  // ── WhatsApp ─────────────────────────────────────────────────────
  { service: "whatsapp", action: "sendMessage",           disposition: "simulate",
    simulatedResponse: { messageId: "demo-wa-id" },
    userMessage: "WhatsApp messages are simulated in demo mode." },

  // ── Clerk ────────────────────────────────────────────────────────
  { service: "clerk", action: "createInvitation",         disposition: "simulate",
    simulatedResponse: { id: "demo_inv_001" },
    userMessage: "Clerk invitations are simulated in demo mode." },
  { service: "clerk", action: "revokeInvitation",         disposition: "simulate",
    simulatedResponse: { id: "demo_inv_001", status: "revoked" },
    userMessage: "Invitation revocation is simulated in demo mode." },
  { service: "clerk", action: "createUser",               disposition: "deny",
    userMessage: "User creation via Clerk is disabled in demo mode." },
  { service: "clerk", action: "deleteUser",               disposition: "deny",
    userMessage: "User deletion is disabled in demo mode." },

  // ── UploadThing ──────────────────────────────────────────────────
  { service: "uploadthing", action: "upload",             disposition: "deny",
    userMessage: "File uploads are disabled in demo mode." },
  { service: "uploadthing", action: "deleteFiles",        disposition: "simulate",
    simulatedResponse: { success: true },
    userMessage: "File deletion is simulated in demo mode." },

  // ── Cron / background jobs ───────────────────────────────────────
  { service: "cron", action: "emailDispatch",             disposition: "simulate",
    userMessage: "Email dispatch cron is simulated in demo mode." },
  { service: "cron", action: "imapRecovery",              disposition: "deny",
    userMessage: "IMAP sync is disabled in demo mode." },
  { service: "cron", action: "providerCostSync",          disposition: "deny",
    userMessage: "Provider cost sync is disabled in demo mode." },
  { service: "cron", action: "pilotCloseout",             disposition: "deny",
    userMessage: "Pilot closeout is disabled in demo mode." },
  { service: "cron", action: "trialExpiry",               disposition: "simulate",
    userMessage: "Trial expiry is simulated in demo mode." },
  { service: "cron", action: "reconciliation",            disposition: "simulate",
    userMessage: "Reconciliation cron is simulated in demo mode." },
];

const policyMap = new Map<string, DemoActionPolicy>();
for (const p of DEMO_POLICIES) {
  policyMap.set(`${p.service}:${p.action}`, p);
}

export function getDemoActionPolicy(
  service: string,
  action: string
): DemoActionPolicy | null {
  if (!isDemoMode()) return null;
  return policyMap.get(`${service}:${action}`) ?? null;
}

/**
 * Convenience: check disposition and throw/return early.
 *
 * @returns `null` when the call should proceed normally,
 *          otherwise the simulated response or throws on `deny`.
 */
export function enforceDemoPolicy<T = unknown>(
  service: string,
  action: string
): T | null {
  const policy = getDemoActionPolicy(service, action);
  if (!policy) return null;

  switch (policy.disposition) {
    case "allow":
      return null;
    case "simulate":
      return (policy.simulatedResponse ?? null) as T;
    case "deny":
      throw new DemoActionBlockedError(
        policy.userMessage || `${service}.${action} is blocked in demo mode.`
      );
  }
}

export class DemoActionBlockedError extends Error {
  public readonly code = "DEMO_ACTION_BLOCKED";
  constructor(message: string) {
    super(message);
    this.name = "DemoActionBlockedError";
  }
}

export function getAllDemoPolicies(): readonly DemoActionPolicy[] {
  return DEMO_POLICIES;
}
