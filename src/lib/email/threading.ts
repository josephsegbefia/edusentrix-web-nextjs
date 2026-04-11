import "server-only";
import { EmailThread, type IEmailThread } from "@/models/EmailThread";
import type { EmailMailboxScope } from "@/models/EmailMessage";
import type { EmailThreadType } from "@/models/EmailThread";
import { generateRoutingToken } from "./routing";

export interface FindOrCreateThreadInput {
  mailboxScope: EmailMailboxScope;
  mailboxKey: string;
  schoolId?: string | null;
  subject: string;
  threadType: EmailThreadType;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  participantEmail: string;
  participantName?: string | null;
  participantRoleHint?: string | null;
  participantUserId?: string | null;
}

/**
 * Find an existing thread by entity link, or create a new one.
 * For entity-linked threads, we match on (relatedEntityType + relatedEntityId + mailboxKey).
 * For manual threads, a new thread is always created.
 */
export async function findOrCreateThread(
  input: FindOrCreateThreadInput,
): Promise<IEmailThread> {
  if (
    input.threadType !== "manual" &&
    input.relatedEntityType &&
    input.relatedEntityId
  ) {
    const existing = await EmailThread.findOne({
      mailboxKey: input.mailboxKey,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      status: { $ne: "archived" },
    }).lean();

    if (existing) {
      return existing as IEmailThread;
    }
  }

  const routingToken = generateRoutingToken();

  const thread = await EmailThread.create({
    mailboxScope: input.mailboxScope,
    mailboxKey: input.mailboxKey,
    schoolId: input.schoolId || null,
    subject: input.subject,
    participants: [
      {
        email: input.participantEmail,
        name: input.participantName || null,
        roleHint: input.participantRoleHint || null,
        userId: input.participantUserId || null,
      },
    ],
    threadType: input.threadType,
    relatedEntityType: input.relatedEntityType || null,
    relatedEntityId: input.relatedEntityId || null,
    lastMessageAt: new Date(),
    routingToken,
    status: "open",
  });

  return thread.toObject() as IEmailThread;
}

/**
 * Update thread timestamps and unread counts after a message is added.
 */
export async function updateThreadAfterMessage(
  threadId: string,
  direction: "outbound" | "inbound",
): Promise<void> {
  const now = new Date();

  const update: Record<string, unknown> = {
    lastMessageAt: now,
  };

  if (direction === "outbound") {
    update.lastOutboundAt = now;
  } else {
    update.lastInboundAt = now;
  }

  const inc: Record<string, number> = {};
  if (direction === "inbound") {
    inc.unreadCountPlatform = 1;
    inc.unreadCountSchool = 1;
  }

  await EmailThread.findByIdAndUpdate(threadId, {
    $set: update,
    ...(Object.keys(inc).length > 0 ? { $inc: inc } : {}),
  });
}
