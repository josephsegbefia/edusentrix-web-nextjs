import "server-only";
import { connectToDatabase } from "@/db/connectToDatabase";
import { EmailMessage } from "@/models/EmailMessage";
import { fetchNewMessages, type FetchedEmail } from "@/lib/email/providers/imap-client";
import {
  getPlatformMailboxConfig,
  listConfiguredPlatformMailboxes,
  type PlatformMailboxId,
} from "@/lib/email/platform-mailboxes";
import { processInboundEmail } from "@/lib/email/services/process-inbound-email";

async function getLastSyncedUid(templateKey: string): Promise<number> {
  const state = await EmailMessage.findOne({ templateKey })
    .select("providerMessageId")
    .lean();

  return state?.providerMessageId
    ? parseInt(state.providerMessageId, 10) || 0
    : 0;
}

async function setLastSyncedUid(
  templateKey: string,
  uid: number,
  mailboxKey: string,
): Promise<void> {
  await EmailMessage.findOneAndUpdate(
    { templateKey },
    {
      $set: {
        providerMessageId: String(uid),
        mailboxKey,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        provider: "spaceship",
        direction: "inbound",
        mailboxScope: "platform",
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
        templateKey,
      },
    },
    { upsert: true },
  );
}

async function persistFetchedEmail(
  email: FetchedEmail,
  mailboxId: PlatformMailboxId,
): Promise<"persisted" | "duplicate" | "error"> {
  try {
    const result = await processInboundEmail({
      provider: "spaceship",
      sender: { email: email.from, name: email.fromName },
      recipients: [...email.to, ...email.cc, ...email.originalRecipients],
      subject: email.subject,
      htmlBody: email.htmlBody,
      textBody: email.textBody,
      messageId: email.messageId,
      inReplyTo: email.inReplyTo,
      references: email.references,
      imapMailbox: mailboxId,
    });

    if (result.duplicate) return "duplicate";
    return result.messageId ? "persisted" : "error";
  } catch (err) {
    console.error(
      `IMAP sync (${mailboxId}): failed to persist UID ${email.uid}:`,
      err,
    );
    return "error";
  }
}

export interface MailboxSyncResult {
  mailbox: PlatformMailboxId;
  fetched: number;
  persisted: number;
  duplicatesSkipped: number;
  errors: number;
  highestUid: number;
  skipped?: boolean;
  skipReason?: string;
}

export interface ImapMailboxSyncSummary {
  mailboxes: MailboxSyncResult[];
  totalPersisted: number;
  totalErrors: number;
}

/**
 * Sync one platform Spacemail mailbox via IMAP (primary inbound path).
 */
export async function runImapMailboxSync(
  mailboxId?: PlatformMailboxId,
  opts?: { resetUid?: boolean },
): Promise<ImapMailboxSyncSummary> {
  if (process.env.EMAIL_SYNC_ENABLED === "false") {
    return {
      mailboxes: [],
      totalPersisted: 0,
      totalErrors: 0,
    };
  }

  await connectToDatabase();

  const targets = mailboxId
    ? [getPlatformMailboxConfig(mailboxId)].filter(Boolean)
    : listConfiguredPlatformMailboxes();

  const results: MailboxSyncResult[] = [];

  for (const mailbox of targets) {
    if (!mailbox) continue;

    const lastUid = opts?.resetUid
      ? 0
      : await getLastSyncedUid(mailbox.syncStateTemplateKey);

    try {
      const { emails, highestUid } = await fetchNewMessages({
        mailbox,
        sinceUid: lastUid,
        limit: 50,
      });

      let persisted = 0;
      let duplicatesSkipped = 0;
      let errors = 0;
      let maxPersistedUid = lastUid;

      for (const email of emails) {
        const outcome = await persistFetchedEmail(email, mailbox.id);
        if (outcome === "persisted") {
          persisted++;
          if (email.uid > maxPersistedUid) maxPersistedUid = email.uid;
        } else if (outcome === "duplicate") {
          duplicatesSkipped++;
          if (email.uid > maxPersistedUid) maxPersistedUid = email.uid;
        } else {
          errors++;
        }
      }

      if (maxPersistedUid > lastUid) {
        await setLastSyncedUid(
          mailbox.syncStateTemplateKey,
          maxPersistedUid,
          mailbox.mailboxKey,
        );
      }

      results.push({
        mailbox: mailbox.id,
        fetched: emails.length,
        persisted,
        duplicatesSkipped,
        errors,
        highestUid,
      });
    } catch (err) {
      results.push({
        mailbox: mailbox.id,
        fetched: 0,
        persisted: 0,
        duplicatesSkipped: 0,
        errors: 1,
        highestUid: lastUid,
        skipped: true,
        skipReason: err instanceof Error ? err.message : "IMAP fetch failed",
      });
    }
  }

  return {
    mailboxes: results,
    totalPersisted: results.reduce((sum, r) => sum + r.persisted, 0),
    totalErrors: results.reduce((sum, r) => sum + r.errors, 0),
  };
}

/** @deprecated Use runImapMailboxSync — kept for dispatch job compatibility. */
export async function runImapRecoverySync() {
  const summary = await runImapMailboxSync();
  const first = summary.mailboxes[0];
  return {
    fetched: summary.mailboxes.reduce((s, m) => s + m.fetched, 0),
    persisted: summary.totalPersisted,
    duplicatesSkipped: summary.mailboxes.reduce(
      (s, m) => s + m.duplicatesSkipped,
      0,
    ),
    errors: summary.totalErrors,
    highestUid: first?.highestUid ?? 0,
  };
}
