/**
 * Compute a short hash for data fingerprinting.
 * Used to detect significant changes before regenerating AI insights.
 */
import { createHash } from "crypto";

export function computeDataFingerprint(data: string | object): string {
  const str = typeof data === "string" ? data : JSON.stringify(data);
  return createHash("sha256").update(str).digest("hex").slice(0, 32);
}
