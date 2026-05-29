import "server-only";
import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import type { PlatformMailboxConfig } from "../platform-mailboxes";

export interface FetchedEmail {
  uid: number;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  from: string;
  fromName: string | null;
  to: string[];
  cc: string[];
  originalRecipients: string[];
  subject: string;
  htmlBody: string | null;
  textBody: string | null;
  date: Date;
  headers: Record<string, string>;
}

/**
 * Fetch new messages from a platform Spacemail INBOX since a given UID.
 * Marks them as seen after fetching.
 */
export async function fetchNewMessages(opts: {
  mailbox: PlatformMailboxConfig;
  sinceUid?: number;
  limit?: number;
}): Promise<{ emails: FetchedEmail[]; highestUid: number }> {
  const client = new ImapFlow({
    host: opts.mailbox.imap.host,
    port: opts.mailbox.imap.port,
    secure: true,
    auth: {
      user: opts.mailbox.imap.user,
      pass: opts.mailbox.imap.password,
    },
    logger: false as const,
  });

  const emails: FetchedEmail[] = [];
  let highestUid = opts.sinceUid ?? 0;

  try {
    await client.connect();

    const lock = await client.getMailboxLock("INBOX");

    try {
      const range = opts.sinceUid ? `${opts.sinceUid + 1}:*` : "1:*";
      const limit = opts.limit ?? 100;
      const uids: number[] = [];

      for await (const message of client.fetch(
        range,
        {
          uid: true,
          flags: true,
          envelope: true,
        },
        { uid: true },
      )) {
        if (message.uid <= (opts.sinceUid ?? 0)) continue;
        uids.push(message.uid);
        if (uids.length >= limit) break;
      }

      for (const uid of uids) {
        try {
          const message = await client.fetchOne(
            String(uid),
            {
              uid: true,
              source: true,
              envelope: true,
            },
            { uid: true },
          );
          if (!message?.source) continue;

          const parsed = await simpleParser(message.source);
          const email = mapParsedMail(parsed, uid);
          emails.push(email);

          if (uid > highestUid) {
            highestUid = uid;
          }

          await client.messageFlagsAdd({ uid }, ["\\Seen"], {
            uid: true,
          });
        } catch (parseErr) {
          console.error(
            `Failed to parse IMAP message UID ${uid} (${opts.mailbox.id}):`,
            parseErr,
          );
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    console.error(`IMAP fetch error (${opts.mailbox.id}):`, err);
    try {
      await client.logout();
    } catch {
      // ignore logout errors during error handling
    }
    throw err;
  }

  return { emails, highestUid };
}

function mapParsedMail(parsed: ParsedMail, uid: number): FetchedEmail {
  const fromAddr = parsed.from?.value?.[0];
  const toAddrs = parsed.to
    ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to])
        .flatMap((addr) => addr.value.map((v) => v.address || ""))
        .filter(Boolean)
    : [];
  const ccAddrs = parsed.cc
    ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc])
        .flatMap((addr) => addr.value.map((v) => v.address || ""))
        .filter(Boolean)
    : [];

  const headers: Record<string, string> = {};
  if (parsed.headers) {
    for (const [key, value] of parsed.headers) {
      const stringValue = stringifyHeaderValue(value);
      if (stringValue) headers[key.toLowerCase()] = stringValue;
    }
  }

  const originalRecipients = dedupeAddresses([
    ...extractAddressesFromHeader(headers["delivered-to"]),
    ...extractAddressesFromHeader(headers["x-original-to"]),
    ...extractAddressesFromHeader(headers["x-envelope-to"]),
    ...extractAddressesFromHeader(headers["envelope-to"]),
    ...extractAddressesFromHeader(headers["original-recipient"]),
    ...extractAddressesFromHeader(headers["resent-to"]),
    ...extractAddressesFromHeader(headers["apparently-to"]),
  ]);

  return {
    uid,
    messageId: parsed.messageId || null,
    inReplyTo: parsed.inReplyTo || null,
    references: parsed.references
      ? Array.isArray(parsed.references)
        ? parsed.references
        : [parsed.references]
      : [],
    from: fromAddr?.address || "",
    fromName: fromAddr?.name || null,
    to: toAddrs,
    cc: ccAddrs,
    originalRecipients,
    subject: parsed.subject || "(No subject)",
    htmlBody: parsed.html ? String(parsed.html) : null,
    textBody: parsed.text || null,
    date: parsed.date || new Date(),
    headers,
  };
}

function stringifyHeaderValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => stringifyHeaderValue(item))
      .filter(Boolean)
      .join(", ");
  }
  if (value && typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("value" in value) return stringifyHeaderValue(value.value);
  }
  return null;
}

function extractAddressesFromHeader(value?: string | null): string[] {
  if (!value) return [];
  return Array.from(value.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi))
    .map((match) => match[0].trim().toLowerCase())
    .filter(Boolean);
}

function dedupeAddresses(addresses: string[]): string[] {
  const seen = new Set<string>();
  return addresses.filter((address) => {
    const normalized = address.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}
