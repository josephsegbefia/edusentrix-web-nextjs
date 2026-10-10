import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import { getR2Config, resetR2ConfigCache } from "@/lib/storage/config";
import { createR2Port, resetR2Client } from "@/lib/storage/r2";

const KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_ENDPOINT",
  "R2_SIGNED_URL_TTL_SECONDS",
] as const;

const snapshot = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
const FIXED_NOW = Date.UTC(2026, 9, 10, 12, 0, 0);

beforeEach(() => {
  process.env.R2_ACCOUNT_ID = "test-account";
  process.env.R2_ACCESS_KEY_ID = "TESTACCESSKEYID";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret-not-real";
  process.env.R2_BUCKET = "test-bucket";
  process.env.R2_ENDPOINT = "https://test-account.r2.cloudflarestorage.com";
  process.env.R2_SIGNED_URL_TTL_SECONDS = "90";
  resetR2ConfigCache();
  resetR2Client();
  mock.timers.enable({ apis: ["Date"], now: FIXED_NOW });
});

afterEach(() => {
  mock.timers.reset();
  for (const key of KEYS) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
  resetR2ConfigCache();
  resetR2Client();
});

describe("presigned GET links (offline, fake credentials)", () => {
  test("carry the configured TTL and the signing time", async () => {
    const ttl = getR2Config().signedUrlTtlSeconds;
    assert.equal(ttl, 90);
    const signed = await createR2Port().createPresignedGet({
      key: "schools/abc/student_avatar/photo.jpg",
      expiresInSeconds: ttl,
      contentDisposition: 'inline; filename="photo.jpg"',
      contentType: "image/jpeg",
    });
    const url = new URL(signed.url);
    assert.equal(url.protocol, "https:");
    assert.equal(url.searchParams.get("X-Amz-Expires"), "90");
    assert.equal(url.searchParams.get("X-Amz-Date"), "20261010T120000Z");
    assert.ok(url.searchParams.get("X-Amz-Signature"));
    assert.equal(url.searchParams.get("token"), null);
    assert.ok(!signed.url.includes("test-secret-not-real"));
    assert.equal(signed.expiresInSeconds, 90);
  });

  test("a different signing time yields a different signature", async () => {
    const port = createR2Port();
    const input = {
      key: "schools/abc/student_avatar/photo.jpg",
      expiresInSeconds: 90,
      contentDisposition: "inline",
      contentType: "image/jpeg",
    };
    const first = new URL((await port.createPresignedGet(input)).url);
    mock.timers.tick(60_000);
    const second = new URL((await port.createPresignedGet(input)).url);
    assert.equal(second.searchParams.get("X-Amz-Date"), "20261010T120100Z");
    assert.notEqual(first.searchParams.get("X-Amz-Signature"), second.searchParams.get("X-Amz-Signature"));
  });

  test("TTL outside 30 to 900 seconds is refused", () => {
    process.env.R2_SIGNED_URL_TTL_SECONDS = "3600";
    resetR2ConfigCache();
    assert.throws(() => getR2Config(), /between 30 and 900/);
  });
});
