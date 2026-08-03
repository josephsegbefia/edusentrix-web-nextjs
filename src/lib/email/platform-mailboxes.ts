import "server-only";

/**
 * Platform operator mailboxes (Spacemail): hello, support, billing.
 * Inbound is IMAP-first; outbound automated mail uses Resend with direct Reply-To.
 * Routed school/parent replies land in the support mailbox via DNS catch-all.
 */

export type PlatformMailboxId = "hello" | "support" | "billing";

export interface PlatformMailboxConfig {
  id: PlatformMailboxId;
  mailboxKey: string;
  address: string;
  imap: {
    host: string;
    port: number;
    user: string;
    password: string;
  };
  syncStateTemplateKey: string;
}

function readEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  // Strip inline `.env` comments (e.g. `mail.spacemail.com # note`)
  const value = raw.split("#")[0]?.trim();
  return value || undefined;
}

/** Spacemail / Spaceship hosted mail uses this IMAP host (not mail.spaceship.com). */
export const DEFAULT_SPACEMAIL_IMAP_HOST = "mail.spacemail.com";

function resolveMailboxAddress(id: PlatformMailboxId): string {
  if (id === "hello") {
    return (
      readEnv("PLATFORM_HELLO_EMAIL") ||
      readEnv("RESEND_DEFAULT_FROM_EMAIL") ||
      "hello@tryedusentrix.app"
    );
  }
  if (id === "billing") {
    return (
      readEnv("PLATFORM_BILLING_EMAIL") ||
      readEnv("RESEND_BILLING_FROM_EMAIL") ||
      "billing@tryedusentrix.app"
    );
  }
  return (
    readEnv("PLATFORM_SUPPORT_EMAIL") ||
    readEnv("SUPPORT_EMAIL") ||
    readEnv("RESEND_SUPPORT_FROM_EMAIL") ||
    "support@tryedusentrix.app"
  );
}

function resolveImapCredentials(id: PlatformMailboxId): {
  host: string;
  port: number;
  user: string;
  password: string;
} | null {
  const prefix = id.toUpperCase();
  const sharedHost =
    readEnv(`SPACEMAIL_${prefix}_IMAP_HOST`) ||
    readEnv("SPACEMAIL_IMAP_HOST") ||
    DEFAULT_SPACEMAIL_IMAP_HOST;
  const sharedPort =
    readEnv(`SPACEMAIL_${prefix}_IMAP_PORT`) ||
    readEnv("SPACEMAIL_IMAP_PORT") ||
    "993";
  const user =
    readEnv(`SPACEMAIL_${prefix}_IMAP_USER`) ||
    (id === "support" ? readEnv("SPACEMAIL_IMAP_USER") : undefined) ||
    resolveMailboxAddress(id);
  const password =
    readEnv(`SPACEMAIL_${prefix}_IMAP_PASSWORD`) ||
    (id === "support" ? readEnv("SPACEMAIL_IMAP_PASSWORD") : undefined);

  if (!sharedHost || !user || !password) return null;

  return {
    host: sharedHost,
    port: parseInt(sharedPort, 10),
    user,
    password,
  };
}

export function getPlatformMailboxConfig(
  id: PlatformMailboxId,
): PlatformMailboxConfig | null {
  const imap = resolveImapCredentials(id);
  if (!imap) return null;

  return {
    id,
    mailboxKey: `platform_${id}`,
    address: resolveMailboxAddress(id),
    imap,
    syncStateTemplateKey: `imap_sync_state_${id}`,
  };
}

export function listConfiguredPlatformMailboxes(): PlatformMailboxConfig[] {
  const ids: PlatformMailboxId[] = ["hello", "support", "billing"];
  return ids
    .map((id) => getPlatformMailboxConfig(id))
    .filter((config): config is PlatformMailboxConfig => config !== null);
}

export function normaliseEmailAddress(value?: string | null): string {
  return value?.trim().toLowerCase() || "";
}

export function directPlatformMailboxForRecipient(
  email: string,
): { mailboxId: PlatformMailboxId; mailboxKey: string; threadType: "support" | "billing" } | null {
  const normalized = normaliseEmailAddress(email);
  const hello = normaliseEmailAddress(resolveMailboxAddress("hello"));
  const support = normaliseEmailAddress(resolveMailboxAddress("support"));
  const billing = normaliseEmailAddress(resolveMailboxAddress("billing"));

  if (normalized === hello) {
    return { mailboxId: "hello", mailboxKey: "platform_hello", threadType: "support" };
  }
  if (normalized === support) {
    return { mailboxId: "support", mailboxKey: "platform_support", threadType: "support" };
  }
  if (normalized === billing) {
    return { mailboxId: "billing", mailboxKey: "platform_billing", threadType: "billing" };
  }
  return null;
}
