import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export type ImpersonationTokenPayload = {
  v: 1;
  actorClerkId: string;
  targetUserId: string;
  schoolId: string;
  exp: number;
};

function b64url(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

export function signImpersonationPayload(
  secret: string,
  payload: ImpersonationTokenPayload
): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(
    createHmac("sha256", secret).update(body, "utf8").digest()
  );
  return `${body}.${sig}`;
}

export function verifyImpersonationToken(
  secret: string,
  token: string
): ImpersonationTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = b64url(
    createHmac("sha256", secret).update(body, "utf8").digest()
  );
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const json = JSON.parse(b64urlDecode(body).toString("utf8")) as ImpersonationTokenPayload;
    if (json.v !== 1 || !json.actorClerkId || !json.targetUserId || !json.schoolId) return null;
    if (Date.now() / 1000 > json.exp) return null;
    return json;
  } catch {
    return null;
  }
}
