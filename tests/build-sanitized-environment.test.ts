import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildSanitizedEnvironment,
  SAFE_BUILD_ENVIRONMENT,
} from "../scripts/run-sanitized-next-build.mjs";

describe("sanitized Next build environment", () => {
  test("uses isolated database and local application values", () => {
    const environment = buildSanitizedEnvironment({
      PATH: "/test/bin",
      MONGODB_URI: "mongodb://persistent.example/school",
      R2_SECRET_ACCESS_KEY: "should-not-pass-through",
      PAYSTACK_SECRET_KEY: "should-not-pass-through",
    });

    assert.deepEqual(environment, {
      PATH: "/test/bin",
      ...SAFE_BUILD_ENVIRONMENT,
    });
  });

  test("does not inherit provider credentials or arbitrary environment values", () => {
    const environment = buildSanitizedEnvironment({
      RESEND_API_KEY: "secret",
      CLERK_SECRET_KEY: "secret",
      R2_ACCESS_KEY_ID: "secret",
      RANDOM_RUNTIME_FLAG: "unexpected",
    });

    assert.equal(environment["RESEND_API_KEY"], undefined);
    assert.equal(environment["CLERK_SECRET_KEY"], undefined);
    assert.equal(environment["R2_ACCESS_KEY_ID"], undefined);
    assert.equal(environment["RANDOM_RUNTIME_FLAG"], undefined);
    assert.equal(environment.__NEXT_PROCESSED_ENV, "1");
  });
});
