/**
 * Email system public API.
 *
 * Import from "@/lib/email" for high-level operations.
 * This re-exports the key services, routing helpers, and registry
 * for use throughout the application.
 */

// High-level send services
export { sendTrackedBrevoEmail } from "./services/send-brevo-email";
export type {
  SendBrevoEmailInput,
  SendBrevoEmailResult,
} from "./services/send-brevo-email";

export { sendManualSupportEmail } from "./services/send-manual-support-email";
export type {
  SendManualSupportEmailInput,
  SendManualSupportEmailResult,
} from "./services/send-manual-support-email";

export { receiveBrevoInbound } from "./services/receive-brevo-inbound";
export { processInboundEmail } from "./services/process-inbound-email";
export { resolveOutboundReplyTo, usesRoutedReplyTo } from "./reply-to";
export {
  getPlatformMailboxConfig,
  listConfiguredPlatformMailboxes,
  directPlatformMailboxForRecipient,
} from "./platform-mailboxes";
export type { PlatformMailboxId, PlatformMailboxConfig } from "./platform-mailboxes";
export type {
  BrevoInboundPayload,
  InboundReceiveResult,
} from "./services/receive-brevo-inbound";

// Registry
export { lookupTemplateRegistry, TEMPLATE_REGISTRY } from "./registry";
export type { TemplateRegistryEntry } from "./registry";

// Routing
export {
  generateRoutingToken,
  buildSchoolReplyAlias,
  buildPlatformReplyAlias,
  buildBillingReplyAlias,
  parseReplyAlias,
} from "./routing";
export type { ParsedReplyAlias } from "./routing";

// Threading
export { findOrCreateThread, updateThreadAfterMessage } from "./threading";

// Suppressions
export {
  checkHardSuppression,
  checkCategoryOptOut,
  applySuppression,
  liftSuppression,
} from "./suppressions";

// Policy
export {
  canSendToRecipient,
  isRetryableError,
  computeBackoffMs,
} from "./policy";

// Sensitivity
export { resolveSecureContentMode, shouldRedactBody } from "./sensitivity";

// Rate limiting
export {
  checkRateLimit,
  recordSend,
  recordBounceOrComplaint,
} from "./rate-limiter";
export type { RateLimitCheckResult } from "./rate-limiter";

// Batch scheduling
export {
  createEmailBatch,
  cancelBatch,
  updateBatchCounters,
} from "./batch-scheduler";
export type {
  BatchRecipient,
  CreateBatchInput,
  CreateBatchResult,
} from "./batch-scheduler";

// Preferences
export { resolveEmailPreference, isCategoryAllowed } from "./preferences";
export type { ResolvedEmailPreference } from "./adapters/teacher-settings";
