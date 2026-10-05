import type { IEmailMessage } from "@/models/EmailMessage";

export const EMAIL_DISPATCH_IDEMPOTENCY_PREFIX = "email-dispatch:";

const SUCCEEDED_STATUSES = ["sent", "delivered", "opened", "clicked"] as const;

export function emailDispatchIdempotencyKey(emailMessageId: string): string {
  return `${EMAIL_DISPATCH_IDEMPOTENCY_PREFIX}${emailMessageId}`;
}

export function emailDispatchRetryIdempotencyKey(emailMessageId: string): string {
  return `${EMAIL_DISPATCH_IDEMPOTENCY_PREFIX}${emailMessageId}:retry`;
}

export function isSucceededEmailStatus(status: IEmailMessage["status"]): boolean {
  return (SUCCEEDED_STATUSES as readonly string[]).includes(status);
}
