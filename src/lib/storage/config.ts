import { StorageConfigError } from "./types";

export const DEFAULT_SIGNED_URL_TTL_SECONDS = 120;

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
  signedUrlTtlSeconds: number;
};

let cached: R2Config | null = null;

function readRequired(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new StorageConfigError(`Storage is not configured (${name} is required)`);
  }
  return value;
}

export function getR2Config(): R2Config {
  if (cached) return cached;

  const ttlRaw = process.env.R2_SIGNED_URL_TTL_SECONDS?.trim();
  const ttl = ttlRaw ? Number(ttlRaw) : DEFAULT_SIGNED_URL_TTL_SECONDS;
  if (!Number.isFinite(ttl) || ttl < 30 || ttl > 900) {
    throw new StorageConfigError("R2_SIGNED_URL_TTL_SECONDS must be between 30 and 900");
  }

  cached = {
    accountId: readRequired("R2_ACCOUNT_ID"),
    accessKeyId: readRequired("R2_ACCESS_KEY_ID"),
    secretAccessKey: readRequired("R2_SECRET_ACCESS_KEY"),
    bucket: readRequired("R2_BUCKET"),
    endpoint: readRequired("R2_ENDPOINT"),
    signedUrlTtlSeconds: ttl,
  };
  return cached;
}

export function resetR2ConfigCache(): void {
  cached = null;
}

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_ENDPOINT
  );
}
