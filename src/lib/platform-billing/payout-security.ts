import crypto from "crypto";

export function generateOtpCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export function hashOtpCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function maskPhoneNumber(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.length <= 4) return trimmed;
  return `${trimmed.slice(0, 3)}${"*".repeat(
    Math.max(0, trimmed.length - 5)
  )}${trimmed.slice(-2)}`;
}

export function maskAccountNumber(accountNumber: string): string {
  const trimmed = accountNumber.trim();
  if (trimmed.length <= 4) return trimmed;
  return `${"*".repeat(Math.max(0, trimmed.length - 4))}${trimmed.slice(-4)}`;
}
