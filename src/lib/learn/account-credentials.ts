import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Types } from "mongoose";
import { LearnStudentAccount } from "@/models/LearnStudentAccount";

const scrypt = promisify(scryptCallback);

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function normalizeUsernamePart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function buildUsernameBase(input: {
  firstName?: string | null;
  lastName?: string | null;
  fallbackId: Types.ObjectId | string;
}) {
  const first = normalizeUsernamePart(input.firstName || "");
  const last = normalizeUsernamePart(input.lastName || "");
  const fallback = String(input.fallbackId).slice(-6).toLowerCase();

  if (first && last) return `${first}.${last}`;
  if (first) return `${first}.${fallback}`;
  if (last) return `${last}.${fallback}`;
  return `learner.${fallback}`;
}

export async function generateUniqueLearnUsername(input: {
  firstName?: string | null;
  lastName?: string | null;
  fallbackId: Types.ObjectId | string;
}) {
  const base = buildUsernameBase(input);
  const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const existing = await LearnStudentAccount.find({
    username: { $regex: `^${escapedBase}\\d*$` },
  })
    .select("username")
    .lean<Array<{ username: string }>>();
  const taken = new Set(existing.map((row) => row.username));

  if (!taken.has(base)) return base;

  for (let suffix = 2; suffix < 10000; suffix += 1) {
    const candidate = `${base}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }

  return `${base}${Date.now().toString(36)}`;
}

export function generateTemporaryLearnPassword(length = 12) {
  const bytes = randomBytes(length);
  let password = "";
  for (let index = 0; index < length; index += 1) {
    password += PASSWORD_ALPHABET[bytes[index] % PASSWORD_ALPHABET.length];
  }
  return password;
}

export async function hashLearnPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}

export async function verifyLearnPassword(password: string, storedHash: string) {
  const [scheme, salt, hash] = storedHash.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;

  const expected = Buffer.from(hash, "base64url");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
