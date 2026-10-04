import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { getR2Config, isR2Configured, resetR2ConfigCache } from "@/lib/storage/config";
import { getStoredAssetUrl } from "@/lib/storage/urls";
import { STORAGE_KINDS } from "@/lib/storage/types";

const KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_ENDPOINT",
  "R2_SIGNED_URL_TTL_SECONDS",
] as const;

const snapshot = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of KEYS) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
  resetR2ConfigCache();
});

describe("R2 config", () => {
  test("importing kinds and urls does not require R2 env", () => {
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    resetR2ConfigCache();
    assert.equal(STORAGE_KINDS.includes("teacher_document"), true);
    assert.equal(
      getStoredAssetUrl("64b7f0c2a1d2e3f405060708"),
      "/api/storage/assets/64b7f0c2a1d2e3f405060708"
    );
    assert.equal(isR2Configured(), false);
  });

  test("missing required vars fail safely only when config is used", () => {
    delete process.env.R2_SECRET_ACCESS_KEY;
    resetR2ConfigCache();
    assert.throws(() => getR2Config(), /Storage is not configured/);
  });

  test("reads a short default TTL and never uses NEXT_PUBLIC vars", () => {
    process.env.R2_ACCOUNT_ID = "acct";
    process.env.R2_ACCESS_KEY_ID = "key";
    process.env.R2_SECRET_ACCESS_KEY = "secret";
    process.env.R2_BUCKET = "edusentrix-files";
    process.env.R2_ENDPOINT = "https://acct.r2.cloudflarestorage.com";
    delete process.env.R2_SIGNED_URL_TTL_SECONDS;
    resetR2ConfigCache();
    const config = getR2Config();
    assert.equal(config.signedUrlTtlSeconds, 120);
    assert.equal(config.bucket, "edusentrix-files");
    assert.equal(process.env.NEXT_PUBLIC_R2_SECRET_ACCESS_KEY, undefined);
  });
});
