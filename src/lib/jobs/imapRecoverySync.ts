import "server-only";
import { connectToDatabase } from "@/db/connectToDatabase";
import { EmailMessage } from "@/models/EmailMessage";
import {
  fetchNewMessages,
  type FetchedEmail,
} from "@/lib/email/providers/imap-client";
import { parseReplyAlias } from "@/lib/email/routing";
import { findOrCreateThread, updateThreadAfterMessage } from "@/lib/email/threading";

/**
 * Persistent state key for tracking the last synced IMAP UID.
 * In production this would be stored in a dedicated settings/state collection.
 * For now we use a simple convention: an EmailMessage with a special templateKey.
 */
const SYNC_STATE_KEY = "imap_recovery_sync_state";

async function getLastSyncedUid(): Promise<number> {
  const state = await EmailMessage.findOne({
    templateKey: SYNC_STATE_KEY,
  })
    .select("providerMessageId")
    .lean();

  return state?.providerMessageId ? parseInt(state.providerMessageId, 10) || 0 : 0;
}

async function setLastSyncedUid(uid: number): Promise<void> {
  await EmailMessage.findOneAndUpdate(
    { templateKey: SYNC_STATE_KEY },
    {
      $set: {
        providerMessageId: String(uid),
        updatedAt: new Date(),
      },
      $setOnInsert: {
        provider: "spaceship",
        direction: "inbound",
        mailboxScope: "platform",
        mailboxKey: "platform_support",
        from: "system",
        to: "system",
        subject: "IMAP Sync State (internal)",
        htmlBody: "",
        status: "sent",
        messageClass: "system",
        trafficClass: "system",
        priority: "low",
        sensitivity: "low",
        secureContentMode: "none",
        templateKey: SYNC_STATE_KEY,
      },
    },
    { upsert: true },
  );
}

async function persistInboundEmail(email: FetchedEmail): Promise<string | null> {
  const existing = email.messageId
    ? await EmailMessage.findOne({ providerMessageId: email.messageId })
        .select("_id")
        .lean()
    : null;

  if (existing) return null;

  let schoolId: string | null = null;
  let threadId: string | null = null;
  let routingToken: string | null = null;

  const allRecipients = [...email.to, ...email.cc];
  for (const recipient of allRecipients) {
    const parsed = parseReplyAlias(recipient);
    if (parsed) {
      schoolId = parsed.schoolId || null;
      routingToken = parsed.routingToken;
      break;
    }
  }

  const mailboxScope = schoolId ? "school" : "platform";
  const mailboxKey = schoolId
    ? `school:${schoolId}:general`
    : "platform_support";

  try {
    const thread = await findOrCreateThread({
      mailboxScope,
      mailboxKey,
      schoolId,
      subject: email.subject,
      threadType: "support",
      participantEmail: email.from,
      participantName: email.fromName,
    });

    threadId = String(thread._id);
  } catch {
    // Thread creation is best-effort for recovery sync
  }

  const message = await EmailMessage.create({
    provider: "spaceship",
    direction: "inbound",
    mailboxScope,
    mailboxKey,
    schoolId,
    threadId,
    from: email.from,
    fromName: email.fromName,
    to: email.to[0] || "",
    subject: email.subject,
    htmlBody: email.htmlBody,
    textBody: email.textBody,
    status: "received",
    messageClass: "support",
    trafficClass: "manual",
    priority: "normal",
    sensitivity: "low",
    secureContentMode: "none",
    providerMessageId: email.messageId,
    routingToken,
    receivedAt: email.date,
    inReplyTo: email.inReplyTo,
  });

  if (threadId) {
    try {
      await updateThreadAfterMessage(threadId, "inbound");
    } catch {
      // Best-effort
    }
  }

  return String(message._id);
}

export interface ImapSyncResult {
  fetched: number;
  persisted: number;
  duplicatesSkipped: number;
  errors: number;
  highestUid: number;
}

/**
 * Fetch new emails from the Spacemail IMAP mailbox and persist them
 * as inbound EmailMessage records. Designed to run from a cron job.
 *
 * This is a recovery/backup sync — the primary inbound path is
 * the Brevo inbound parse webhook.
 */
export async function runImapRecoverySync(): Promise<ImapSyncResult> {
  await connectToDatabase();

  const lastUid = await getLastSyncedUid();

  let emails: FetchedEmail[];
  let highestUid: number;

  try {
    const result = await fetchNewMessages({
      sinceUid: lastUid,
      limit: 50,
    });
    emails = result.emails;
    highestUid = result.highestUid;
  } catch (err) {
    console.error("IMAP recovery sync: fetch failed", err);
    return {
      fetched: 0,
      persisted: 0,
      duplicatesSkipped: 0,
      errors: 1,
      highestUid: lastUid,
    };
  }

  let persisted = 0;
  let duplicatesSkipped = 0;
  let errors = 0;

  for (const email of emails) {
    try {
      const messageId = await persistInboundEmail(email);
      if (messageId) {
        persisted++;
      } else {
        duplicatesSkipped++;
      }
    } catch (err) {
      console.error(
        `IMAP recovery sync: failed to persist email UID ${email.uid}:`,
        err,
      );
      errors++;
    }
  }

  if (highestUid > lastUid) {
    await setLastSyncedUid(highestUid);
  }

  return {
    fetched: emails.length,
    persisted,
    duplicatesSkipped,
    errors,
    highestUid,
  };
}
