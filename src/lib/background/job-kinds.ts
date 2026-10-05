export const BACKGROUND_JOB_KINDS = [
  "EMAIL_DISPATCH",
  "COMMUNICATION_OUTBOX",
  "SCHOOL_PROVISIONING",
  "EXPLORE_GENERATION",
  "AI_LESSON_GENERATION",
  "AI_LESSON_ILLUSTRATION",
  "AI_CONTENT_GENERATION",
  "AI_DOCUMENT_ANALYSIS",
  "LIBRARY_IMPORT",
  "SCHEME_IMPORT",
  "BULK_IMPORT",
  "REPORT_GENERATION",
  "FINANCE_RECONCILIATION",
  "STORAGE_PURGE",
  "STORAGE_BACKUP",
  "STORAGE_RECONCILIATION",
  "IMAP_RECOVERY",
  "SUBSCRIPTION_MAINTENANCE",
  "SYSTEM_BACKGROUND_SMOKE",
] as const;

export type BackgroundJobKind = (typeof BACKGROUND_JOB_KINDS)[number];

export const BACKGROUND_WORKLOAD_CLASSES = [
  "EMAIL",
  "AI",
  "IMPORT",
  "PROVISIONING",
  "STORAGE",
  "SYSTEM",
] as const;

export type BackgroundWorkloadClass = (typeof BACKGROUND_WORKLOAD_CLASSES)[number];

export type BackgroundJobKindPolicy = {
  kind: BackgroundJobKind;
  displayLabel: string;
  workloadClass: BackgroundWorkloadClass;
  retryPolicyId: BackgroundWorkloadClass;
  cancellable: boolean;
  userVisible: boolean;
  schoolScoped: boolean;
  notifyOnSuccessDefault: boolean;
  notifyOnFailureDefault: boolean;
};

const KIND_POLICIES: Record<BackgroundJobKind, BackgroundJobKindPolicy> = {
  EMAIL_DISPATCH: {
    kind: "EMAIL_DISPATCH",
    displayLabel: "Email dispatch",
    workloadClass: "EMAIL",
    retryPolicyId: "EMAIL",
    cancellable: false,
    userVisible: false,
    schoolScoped: false,
    notifyOnSuccessDefault: false,
    notifyOnFailureDefault: false,
  },
  COMMUNICATION_OUTBOX: {
    kind: "COMMUNICATION_OUTBOX",
    displayLabel: "Communication delivery",
    workloadClass: "EMAIL",
    retryPolicyId: "EMAIL",
    cancellable: false,
    userVisible: false,
    schoolScoped: true,
    notifyOnSuccessDefault: false,
    notifyOnFailureDefault: false,
  },
  SCHOOL_PROVISIONING: {
    kind: "SCHOOL_PROVISIONING",
    displayLabel: "School provisioning",
    workloadClass: "PROVISIONING",
    retryPolicyId: "PROVISIONING",
    cancellable: false,
    userVisible: true,
    schoolScoped: true,
    notifyOnSuccessDefault: true,
    notifyOnFailureDefault: true,
  },
  EXPLORE_GENERATION: {
    kind: "EXPLORE_GENERATION",
    displayLabel: "Explore generation",
    workloadClass: "AI",
    retryPolicyId: "AI",
    cancellable: true,
    userVisible: true,
    schoolScoped: true,
    notifyOnSuccessDefault: true,
    notifyOnFailureDefault: true,
  },
  AI_LESSON_GENERATION: {
    kind: "AI_LESSON_GENERATION",
    displayLabel: "Lesson generation",
    workloadClass: "AI",
    retryPolicyId: "AI",
    cancellable: true,
    userVisible: true,
    schoolScoped: true,
    notifyOnSuccessDefault: true,
    notifyOnFailureDefault: true,
  },
  AI_LESSON_ILLUSTRATION: {
    kind: "AI_LESSON_ILLUSTRATION",
    displayLabel: "Lesson illustration",
    workloadClass: "AI",
    retryPolicyId: "AI",
    cancellable: true,
    userVisible: true,
    schoolScoped: true,
    notifyOnSuccessDefault: true,
    notifyOnFailureDefault: true,
  },
  AI_CONTENT_GENERATION: {
    kind: "AI_CONTENT_GENERATION",
    displayLabel: "Content generation",
    workloadClass: "AI",
    retryPolicyId: "AI",
    cancellable: true,
    userVisible: true,
    schoolScoped: true,
    notifyOnSuccessDefault: true,
    notifyOnFailureDefault: true,
  },
  AI_DOCUMENT_ANALYSIS: {
    kind: "AI_DOCUMENT_ANALYSIS",
    displayLabel: "Document analysis",
    workloadClass: "AI",
    retryPolicyId: "AI",
    cancellable: true,
    userVisible: true,
    schoolScoped: true,
    notifyOnSuccessDefault: true,
    notifyOnFailureDefault: true,
  },
  LIBRARY_IMPORT: {
    kind: "LIBRARY_IMPORT",
    displayLabel: "Library import",
    workloadClass: "IMPORT",
    retryPolicyId: "IMPORT",
    cancellable: true,
    userVisible: true,
    schoolScoped: true,
    notifyOnSuccessDefault: true,
    notifyOnFailureDefault: true,
  },
  SCHEME_IMPORT: {
    kind: "SCHEME_IMPORT",
    displayLabel: "Scheme import",
    workloadClass: "IMPORT",
    retryPolicyId: "IMPORT",
    cancellable: true,
    userVisible: true,
    schoolScoped: true,
    notifyOnSuccessDefault: true,
    notifyOnFailureDefault: true,
  },
  BULK_IMPORT: {
    kind: "BULK_IMPORT",
    displayLabel: "Bulk import",
    workloadClass: "IMPORT",
    retryPolicyId: "IMPORT",
    cancellable: true,
    userVisible: true,
    schoolScoped: true,
    notifyOnSuccessDefault: true,
    notifyOnFailureDefault: true,
  },
  REPORT_GENERATION: {
    kind: "REPORT_GENERATION",
    displayLabel: "Report generation",
    workloadClass: "SYSTEM",
    retryPolicyId: "SYSTEM",
    cancellable: true,
    userVisible: true,
    schoolScoped: true,
    notifyOnSuccessDefault: true,
    notifyOnFailureDefault: true,
  },
  FINANCE_RECONCILIATION: {
    kind: "FINANCE_RECONCILIATION",
    displayLabel: "Finance reconciliation",
    workloadClass: "SYSTEM",
    retryPolicyId: "SYSTEM",
    cancellable: false,
    userVisible: true,
    schoolScoped: true,
    notifyOnSuccessDefault: true,
    notifyOnFailureDefault: true,
  },
  STORAGE_PURGE: {
    kind: "STORAGE_PURGE",
    displayLabel: "Storage purge",
    workloadClass: "STORAGE",
    retryPolicyId: "STORAGE",
    cancellable: false,
    userVisible: false,
    schoolScoped: false,
    notifyOnSuccessDefault: false,
    notifyOnFailureDefault: false,
  },
  STORAGE_BACKUP: {
    kind: "STORAGE_BACKUP",
    displayLabel: "Storage backup",
    workloadClass: "STORAGE",
    retryPolicyId: "STORAGE",
    cancellable: false,
    userVisible: false,
    schoolScoped: false,
    notifyOnSuccessDefault: false,
    notifyOnFailureDefault: false,
  },
  STORAGE_RECONCILIATION: {
    kind: "STORAGE_RECONCILIATION",
    displayLabel: "Storage reconciliation",
    workloadClass: "STORAGE",
    retryPolicyId: "STORAGE",
    cancellable: false,
    userVisible: false,
    schoolScoped: false,
    notifyOnSuccessDefault: false,
    notifyOnFailureDefault: false,
  },
  IMAP_RECOVERY: {
    kind: "IMAP_RECOVERY",
    displayLabel: "Mailbox recovery",
    workloadClass: "EMAIL",
    retryPolicyId: "EMAIL",
    cancellable: false,
    userVisible: false,
    schoolScoped: false,
    notifyOnSuccessDefault: false,
    notifyOnFailureDefault: false,
  },
  SUBSCRIPTION_MAINTENANCE: {
    kind: "SUBSCRIPTION_MAINTENANCE",
    displayLabel: "Subscription maintenance",
    workloadClass: "SYSTEM",
    retryPolicyId: "SYSTEM",
    cancellable: false,
    userVisible: false,
    schoolScoped: false,
    notifyOnSuccessDefault: false,
    notifyOnFailureDefault: false,
  },
  SYSTEM_BACKGROUND_SMOKE: {
    kind: "SYSTEM_BACKGROUND_SMOKE",
    displayLabel: "Background engine smoke",
    workloadClass: "SYSTEM",
    retryPolicyId: "SYSTEM",
    cancellable: true,
    userVisible: false,
    schoolScoped: false,
    notifyOnSuccessDefault: false,
    notifyOnFailureDefault: false,
  },
};

export function isBackgroundJobKind(value: string): value is BackgroundJobKind {
  return (BACKGROUND_JOB_KINDS as readonly string[]).includes(value);
}

export function getBackgroundJobKindPolicy(kind: BackgroundJobKind): BackgroundJobKindPolicy {
  return KIND_POLICIES[kind];
}

export function requireBackgroundJobKind(value: string): BackgroundJobKind {
  if (!isBackgroundJobKind(value)) {
    throw new Error(`Unknown background job kind: ${value}`);
  }
  return value;
}
