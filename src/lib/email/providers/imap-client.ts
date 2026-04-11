import "server-only";
import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";

const {
  SPACEMAIL_IMAP_HOST,
  SPACEMAIL_IMAP_PORT,
  SPACEMAIL_IMAP_USER,
  SPACEMAIL_IMAP_PASSWORD,
} = process.env;

function getImapConfig() {
  if (!SPACEMAIL_IMAP_HOST || !SPACEMAIL_IMAP_USER || !SPACEMAIL_IMAP_PASSWORD) {
    throw new Error("Spacemail IMAP credentials not configured");
  }
  return {
    host: SPACEMAIL_IMAP_HOST,
    port: parseInt(SPACEMAIL_IMAP_PORT || "993", 10),
    secure: true,
    auth: {
      user: SPACEMAIL_IMAP_USER,
      pass: SPACEMAIL_IMAP_PASSWORD,
    },
    logger: false as const,
  };
}

export interface FetchedEmail {
  uid: number;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  from: string;
  fromName: string | null;
  to: string[];
  cc: string[];
  subject: string;
  htmlBody: string | null;
  textBody: string | null;
  date: Date;
  headers: Record<string, string>;
}

/**
 * Fetch unseen messages from the Spacemail INBOX since a given UID.
 * Marks them as seen after fetching. Returns parsed emails.
 */
export async function fetchNewMessages(opts?: {
  sinceUid?: number;
  mailbox?: string;
  limit?: number;
}): Promise<{ emails: FetchedEmail[]; highestUid: number }> {
  const config = getImapConfig();
  const client = new ImapFlow(config);

  const emails: FetchedEmail[] = [];
  let highestUid = opts?.sinceUid ?? 0;

  try {
    await client.connect();

    const lock = await client.getMailboxLock(opts?.mailbox || "INBOX");

    try {
      const range = opts?.sinceUid ? `${opts.sinceUid + 1}:*` : "1:*";
      const limit = opts?.limit ?? 100;
      let count = 0;

      for await (const message of client.fetch(range, {
        uid: true,
        source: true,
        flags: true,
        envelope: true,
      })) {
        if (count >= limit) break;

        if (message.uid <= (opts?.sinceUid ?? 0)) continue;

        try {
          const parsed = await simpleParser(message.source);
          const email = mapParsedMail(parsed, message.uid);
          emails.push(email);

          if (message.uid > highestUid) {
            highestUid = message.uid;
          }

          await client.messageFlagsAdd({ uid: message.uid }, ["\\Seen"], {
            uid: true,
          });

          count++;
        } catch (parseErr) {
          console.error(`Failed to parse IMAP message UID ${message.uid}:`, parseErr);
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    console.error("IMAP fetch error:", err);
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
      if (typeof value === "string") {
        headers[key] = value;
      }
    }
  }

  return {
    uid,
    messageId: parsed.messageId || null,
    inReplyTo: parsed.inReplyTo || null,
    references: parsed.references
      ? (Array.isArray(parsed.references) ? parsed.references : [parsed.references])
      : [],
    from: fromAddr?.address || "",
    fromName: fromAddr?.name || null,
    to: toAddrs,
    cc: ccAddrs,
    subject: parsed.subject || "(No subject)",
    htmlBody: parsed.html ? String(parsed.html) : null,
    textBody: parsed.text || null,
    date: parsed.date || new Date(),
    headers,
  };
}
