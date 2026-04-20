import "server-only";
import crypto from "crypto";
import { getBootstrapPathSecret } from "@/lib/platform-bootstrap/config";

export function bootstrapKeyFingerprint(pathSecret: string): string {
  const pepper =
    process.env.PLATFORM_BOOTSTRAP_KEY_PEPPER?.trim() ||
    "edusentrix-platform-bootstrap-v1";
  return crypto
    .createHash("sha256")
    .update(`${pepper}:${pathSecret}`, "utf8")
    .digest("hex");
}

export function isValidBootstrapPathSecret(provided: string | undefined): boolean {
  const expected = getBootstrapPathSecret();
  if (!provided || !expected || expected.length < 24) return false;
  if (provided.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}

export function assertBootstrapConfigured(): void {
  const s = getBootstrapPathSecret();
  if (!s || s.length < 24) {
    throw new Error(
      "PLATFORM_ADMIN_BOOTSTRAP_SECRET is missing or too short (use at least 24 random characters)."
    );
  }
}
