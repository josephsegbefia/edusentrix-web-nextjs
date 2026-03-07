export const PLATFORM_BILLING_PROVIDERS = [
  "clerk",
  "mongodb",
  "vercel",
  "openai",
  "uploadthing",
  "paystack",
  "email",
  "storage",
  "internal",
] as const;

export type PlatformBillingProvider =
  (typeof PLATFORM_BILLING_PROVIDERS)[number];

export const PLATFORM_BILLING_PROVIDER_LABELS: Record<
  PlatformBillingProvider,
  string
> = {
  clerk: "Clerk",
  mongodb: "MongoDB",
  vercel: "Vercel",
  openai: "OpenAI",
  uploadthing: "UploadThing",
  paystack: "Paystack",
  email: "Email",
  storage: "Storage",
  internal: "Internal Platform",
};
