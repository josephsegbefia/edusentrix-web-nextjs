import "server-only";

import { EmailMessage } from "@/models/EmailMessage";
import { EmailThread } from "@/models/EmailThread";
import { EmailDispatchJob } from "@/models/EmailDispatchJob";
import type { EmailMailboxScope } from "@/models/EmailMessage";
import { parseReplyAlias } from "../routing";
import { findOrCreateThread, updateThreadAfterMessage } from "../threading";
import {
  directPlatformMailboxForRecipient,
  type PlatformMailboxId,
} from "../platform-mailboxes";
import { handleProposalInboundReply } from "@/lib/proposals/reply-handler";

export interface InboundEmailInput {
  provider: "spaceship" | "brevo";
  sender: { email: string; name?: string | null };
  recipients: string[];
  subject: string;
  htmlBody?: string | null;
  textBody?: string | null;
  messageId?: string | null;
  inReplyTo?: string | null;
  references?: string[] | null;
  /** Which platform IMAP mailbox this message was fetched from (if applicable). */
  imapMailbox?: PlatformMailboxId | null;
  rawPayload?: Record<string, unknown>;
}

export interface InboundProcessResult {
  messageId: string;
  threadId?: string;
  routed: boolean;
  duplicate?: boolean;
}

function normaliseMessageId(value?: string | null): string | null {
  if (!value?.trim()) return null;
  return value.trim().replace(/^<|>$/g, "");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function messageIdCandidates(values: Array<string | null | undefined>): string[] {
  const candidates = new Set<string>();
  for (const value of values) {
    const normalized = normaliseMessageId(value);
    if (!normalized) continue;
    candidates.add(normalized);
    candidates.add(`<${normalized}>`);
  }
  return [...candidates];
}

async function findThreadByReplyHeaders(args: {
  inReplyTo?: string | null;
  references?: string[] | null;
}): Promise<{
  threadId: string;
  thread: {
    mailboxScope?: EmailMailboxScope | null;
    mailboxKey?: string | null;
    schoolId?: unknown;
    relatedEntityType?: string | null;
    relatedEntityId?: unknown;
  };
} | null> {
  const candidates = messageIdCandidates([
    args.inReplyTo,
    ...(args.references || []),
  ]);
  if (candidates.length === 0) return null;

  const regexes = candidates
    .map((candidate) => normaliseMessageId(candidate))
    .filter((candidate): candidate is string => Boolean(candidate))
    .map((candidate) => new RegExp(escapeRegex(candidate), "i"));

  const prior = await EmailMessage.findOne({
    direction: "outbound",
    $or: [
      { messageIdHeader: { $in: candidates } },
      { providerMessageId: { $in: candidates } },
      ...regexes.flatMap((regex) => [
        { messageIdHeader: regex },
        { providerMessageId: regex },
      ]),
    ],
  })
    .select("threadId")
    .lean();

  if (!prior?.threadId) return null;

  const thread = await EmailThread.findById(prior.threadId)
    .select("mailboxScope mailboxKey schoolId relatedEntityType relatedEntityId")
    .lean();

  if (!thread) return null;

  return {
    threadId: String(prior.threadId),
    thread,
  };
}

function dedupeRecipients(recipients: string[]): string[] {
  const seen = new Set<string>();
  return recipients.filter((recipient) => {
    const normalized = recipient.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

async function maybeNotifyProposalReply(args: {
  routedThread: { relatedEntityType?: string | null; relatedEntityId?: unknown } | null;
  fromEmail: string;
  fromName?: string | null;
  subject: string;
  threadId: string;
}) {
  if (
    args.routedThread?.relatedEntityType === "Proposal" &&
    args.routedThread.relatedEntityId
  ) {
    void handleProposalInboundReply({
      proposalId: String(args.routedThread.relatedEntityId),
      fromEmail: args.fromEmail,
      fromName: args.fromName ?? null,
      subject: args.subject,
      threadId: args.threadId,
    }).catch((err) =>
      console.error("[process-inbound-email] proposal reply handler failed", err),
    );
  }
}

/**
 * Primary inbound processor for IMAP (and optional Brevo inbound backup).
 */
export async function processInboundEmail(
  input: InboundEmailInput,
): Promise<InboundProcessResult> {
  const candidateRecipients = dedupeRecipients(input.recipients);
  const routedRecipient = candidateRecipients.find((recipient) =>
    parseReplyAlias(recipient),
  );
  const toAddress =
    routedRecipient || candidateRecipients[0] || input.sender.email;

  if (!toAddress) {
    throw new Error("No recipient address in inbound email");
  }

  const existingByMsgId = input.messageId
    ? await EmailMessage.findOne({
        $or: [
          { messageIdHeader: input.messageId, direction: "inbound" },
          { providerMessageId: input.messageId, direction: "inbound" },
        ],
      }).lean()
    : null;

  if (existingByMsgId) {
    return {
      messageId: String(existingByMsgId._id),
      threadId: existingByMsgId.threadId
        ? String(existingByMsgId.threadId)
        : undefined,
      routed: true,
      duplicate: true,
    };
  }

  const parsed = parseReplyAlias(toAddress);

  let threadId: string | undefined;
  let schoolId: string | undefined;
  let mailboxScope: "platform" | "school" = "platform";
  let mailboxKey = input.imapMailbox
    ? `platform_${input.imapMailbox}`
    : "platform_support";
  let routedThread:
    | { relatedEntityType?: string | null; relatedEntityId?: unknown }
    | null = null;

  if (parsed) {
    if (parsed.scope === "school" && parsed.schoolId) {
      mailboxScope = "school";
      schoolId = parsed.schoolId;
      mailboxKey = `school:${parsed.schoolId}:general`;
    } else if (parsed.scope === "billing" && parsed.schoolId) {
      mailboxScope = "school";
      schoolId = parsed.schoolId;
      mailboxKey = `school:${parsed.schoolId}:billing`;
    } else if (parsed.scope === "platform") {
      mailboxScope = "platform";
      mailboxKey = `platform_${parsed.inboxKey || "support"}`;
    }

    const thread = await EmailThread.findOne({
      routingToken: parsed.routingToken,
    }).lean();

    if (thread) {
      threadId = String(thread._id);
      routedThread = thread;
    }
  } else {
    const inReplyMatch = await findThreadByReplyHeaders({
      inReplyTo: input.inReplyTo,
      references: input.references,
    });
    if (inReplyMatch) {
      threadId = inReplyMatch.threadId;
      routedThread = inReplyMatch.thread;
      mailboxScope = inReplyMatch.thread.mailboxScope || mailboxScope;
      mailboxKey = inReplyMatch.thread.mailboxKey || mailboxKey;
      schoolId = inReplyMatch.thread.schoolId
        ? String(inReplyMatch.thread.schoolId)
        : undefined;
    } else {
      const directMailbox =
        candidateRecipients
          .map((recipient) => directPlatformMailboxForRecipient(recipient))
          .find(Boolean) || null;
      if (directMailbox) {
        mailboxScope = "platform";
        mailboxKey = directMailbox.mailboxKey;
        const thread = await findOrCreateThread({
          mailboxScope,
          mailboxKey,
          subject: input.subject || "(No subject)",
          threadType: directMailbox.threadType,
          participantEmail: input.sender.email,
          participantName: input.sender.name || null,
        });
        threadId = String(thread._id);
        routedThread = thread;
      } else if (input.imapMailbox) {
        mailboxScope = "platform";
        mailboxKey = `platform_${input.imapMailbox}`;
        const thread = await findOrCreateThread({
          mailboxScope,
          mailboxKey,
          subject: input.subject || "(No subject)",
          threadType: input.imapMailbox === "billing" ? "billing" : "support",
          participantEmail: input.sender.email,
          participantName: input.sender.name || null,
        });
        threadId = String(thread._id);
        routedThread = thread;
      }
    }
  }

  const message = await EmailMessage.create({
    provider: input.provider,
    direction: "inbound",
    mailboxScope,
    mailboxKey,
    schoolId: schoolId || null,
    threadId: threadId || null,
    from: input.sender.email,
    fromName: input.sender.name || null,
    to: toAddress,
    subject: input.subject || "(No subject)",
    htmlBody: input.htmlBody || null,
    textBody: input.textBody || null,
    status: threadId ? "received" : "routing",
    messageClass: "support",
    trafficClass: "system",
    priority: "normal",
    sensitivity: "low",
    secureContentMode: "none",
    messageIdHeader: input.messageId || null,
    providerMessageId: input.messageId || null,
    inReplyTo: input.inReplyTo || null,
    referencesHeader: input.references || null,
    routingToken: parsed?.routingToken || null,
    receivedAt: new Date(),
  });

  if (threadId) {
    await updateThreadAfterMessage(threadId, "inbound");
    await maybeNotifyProposalReply({
      routedThread,
      fromEmail: input.sender.email,
      fromName: input.sender.name,
      subject: input.subject,
      threadId,
    });

    return {
      messageId: String(message._id),
      threadId,
      routed: true,
    };
  }

  await EmailDispatchJob.create({
    kind: "inbound_route",
    emailMessageId: message._id,
    schoolId: schoolId || null,
    trafficClass: "system",
    priority: "normal",
    status: "pending",
    maxAttempts: 5,
    payload: { rawPayload: input.rawPayload || {} },
  });

  return {
    messageId: String(message._id),
    routed: false,
  };
}
