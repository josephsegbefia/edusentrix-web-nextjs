// src/lib/demo/config.ts
// Demo system configuration - centralized settings

import type { DemoSeedConfig, DemoFeatureConfig } from "@/types/demo";

/**
 * Demo mode is determined by environment variable.
 * When true, demo-specific routes and features are enabled.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

/**
 * Session timeouts
 */
export const DEMO_SESSION = {
  /** Inactivity timeout in milliseconds (30 minutes) */
  INACTIVITY_TIMEOUT_MS: 30 * 60 * 1000,
  /** Hard session limit in milliseconds (2 hours) */
  HARD_TIMEOUT_MS: 2 * 60 * 60 * 1000,
  /** Magic link expiration in milliseconds (1 hour) */
  MAGIC_LINK_EXPIRY_MS: 60 * 60 * 1000,
  /** Cookie name for demo session */
  COOKIE_NAME: "edusentrix_demo_session",
  /** Cookie max age in seconds */
  COOKIE_MAX_AGE: 2 * 60 * 60, // 2 hours
} as const;

/**
 * Rate limiting for demo signups
 */
export const DEMO_RATE_LIMITS = {
  /** Max demo sessions per email per 24 hours */
  MAX_PER_EMAIL_24H: 1,
  /** Max demo sessions per IP per 24 hours */
  MAX_PER_IP_24H: 3,
  /** Cooldown between sessions for same email (24 hours) */
  EMAIL_COOLDOWN_MS: 24 * 60 * 60 * 1000,
} as const;

/**
 * Demo data seeding configuration
 */
export const DEMO_SEED_CONFIG: DemoSeedConfig = {
  studentsCount: 75,
  teachersCount: 15,
  classGroupsCount: 8,
  subjectsCount: 12,
  invoicesCount: 20,
  activitiesCount: 30,
};

/**
 * Sales notification email recipients
 */
export const DEMO_SALES_EMAILS = process.env.DEMO_SALES_NOTIFICATION_EMAILS
  ? process.env.DEMO_SALES_NOTIFICATION_EMAILS.split(",").map((e) => e.trim())
  : ["sales@edusentrix.com"];

/**
 * Feature restrictions for demo mode
 * - allowed: true = full access
 * - allowed: false, simulateAction: true = show action but display message
 * - allowed: false, simulateAction: false = disabled entirely
 */
export const DEMO_FEATURES: DemoFeatureConfig[] = [
  // READ ALLOWED (showcase value)
  { feature: "dashboard:view", allowed: true },
  { feature: "students:list", allowed: true },
  { feature: "students:detail", allowed: true },
  { feature: "teachers:list", allowed: true },
  { feature: "teachers:detail", allowed: true },
  { feature: "classes:list", allowed: true },
  { feature: "classes:detail", allowed: true },
  { feature: "periods:list", allowed: true },
  { feature: "fees:view", allowed: true },
  { feature: "invoices:list", allowed: true },
  { feature: "reports:view", allowed: true },
  { feature: "search", allowed: true },
  { feature: "command_palette", allowed: true },
  { feature: "docs", allowed: true },

  // SIMULATED (show capability)
  {
    feature: "students:create",
    allowed: false,
    simulateAction: true,
    message:
      "In demo mode, student creation is simulated. Contact us for full access!",
  },
  {
    feature: "students:edit",
    allowed: false,
    simulateAction: true,
    message:
      "In demo mode, editing is simulated. Contact us for full access!",
  },
  {
    feature: "teachers:create",
    allowed: false,
    simulateAction: true,
    message:
      "In demo mode, teacher creation is simulated. Contact us for full access!",
  },
  {
    feature: "teachers:edit",
    allowed: false,
    simulateAction: true,
    message: "In demo mode, editing is simulated. Contact us for full access!",
  },
  {
    feature: "invoices:create",
    allowed: false,
    simulateAction: true,
    message:
      "In demo mode, invoice creation is simulated. Contact us for full access!",
  },

  // BLOCKED (security/abuse prevention)
  {
    feature: "students:delete",
    allowed: false,
    simulateAction: false,
    message: "Delete operations are disabled in demo mode.",
  },
  {
    feature: "teachers:delete",
    allowed: false,
    simulateAction: false,
    message: "Delete operations are disabled in demo mode.",
  },
  {
    feature: "bulk_import",
    allowed: false,
    simulateAction: false,
    message: "Bulk import is disabled in demo mode.",
  },
  {
    feature: "payments:process",
    allowed: false,
    simulateAction: false,
    message: "Payment processing is disabled in demo mode.",
  },
  {
    feature: "email:send",
    allowed: false,
    simulateAction: false,
    message: "Email sending is disabled in demo mode.",
  },
  {
    feature: "settings:edit",
    allowed: false,
    simulateAction: false,
    message: "Settings are read-only in demo mode.",
  },
  {
    feature: "users:manage",
    allowed: false,
    simulateAction: false,
    message: "User management is disabled in demo mode.",
  },
  {
    feature: "api_keys",
    allowed: false,
    simulateAction: false,
    message: "API keys are not available in demo mode.",
  },
  {
    feature: "export",
    allowed: false,
    simulateAction: false,
    message: "Data export is disabled in demo mode. Contact us for full access!",
  },
];

/**
 * High-intent signals that trigger sales alerts
 */
export const HIGH_INTENT_SIGNALS = [
  "viewed_pricing",
  "attempted_invoice_create",
  "attempted_bulk_import",
  "clicked_contact_sales",
  "clicked_schedule_demo",
  "session_duration_30min",
  "viewed_reports",
  "multiple_feature_exploration",
] as const;

/**
 * Disposable email domains to block
 */
export const BLOCKED_EMAIL_DOMAINS = [
  "tempmail.com",
  "throwaway.email",
  "guerrillamail.com",
  "10minutemail.com",
  "mailinator.com",
  "yopmail.com",
  "temp-mail.org",
  "fakeinbox.com",
  "getnada.com",
  "maildrop.cc",
];

/**
 * Check if demo mode is enabled
 */
export function isDemoMode(): boolean {
  return DEMO_MODE;
}

/**
 * Get feature configuration
 */
export function getDemoFeature(feature: string): DemoFeatureConfig | undefined {
  return DEMO_FEATURES.find((f) => f.feature === feature);
}

/**
 * Check if a feature is allowed in demo mode
 */
export function isDemoFeatureAllowed(feature: string): boolean {
  if (!DEMO_MODE) return true; // Not in demo mode, all allowed
  const config = getDemoFeature(feature);
  return config?.allowed ?? true; // Default to allowed if not configured
}

/**
 * Check if email domain is blocked
 */
export function isEmailDomainBlocked(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return true;
  return BLOCKED_EMAIL_DOMAINS.includes(domain);
}

/**
 * Generate a demo tenant ID
 */
export function generateDemoTenantId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `demo_${timestamp}_${random}`;
}

/**
 * Generate a magic link token
 */
export function generateMagicLinkToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
