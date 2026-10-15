import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import {
  validateAppOriginConfiguration,
} from "../src/lib/runtime/app-origin-config";
import { getInvitationRedirectUrl } from "../src/lib/utils/getAppUrl";

const originalEnvironment = {
  APP_RUNTIME_MODE: process.env.APP_RUNTIME_MODE,
  APP_URL: process.env.APP_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
};

function restore(name: keyof typeof originalEnvironment) {
  const value = originalEnvironment[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restore("APP_RUNTIME_MODE");
  restore("APP_URL");
  restore("NEXT_PUBLIC_APP_URL");
});

describe("application origin configuration", () => {
  test("accepts matching localhost origins in development", () => {
    assert.deepEqual(
      validateAppOriginConfiguration({
        APP_RUNTIME_MODE: "development",
        APP_URL: "http://localhost:3000",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      }),
      []
    );
  });

  test("rejects a production EduSentrix origin in development", () => {
    const errors = validateAppOriginConfiguration({
      APP_RUNTIME_MODE: "development",
      APP_URL: "https://tryedusentrix.app",
      NEXT_PUBLIC_APP_URL: "https://tryedusentrix.app",
    });
    assert.equal(errors.length, 2);
    assert.ok(errors.every((error) => error.includes("APP_RUNTIME_MODE=development")));
  });

  test("accepts matching production HTTPS origins", () => {
    assert.deepEqual(
      validateAppOriginConfiguration({
        APP_RUNTIME_MODE: "production",
        APP_URL: "https://tryedusentrix.app",
        NEXT_PUBLIC_APP_URL: "https://tryedusentrix.app",
      }),
      []
    );
  });

  test("rejects localhost and insecure origins in production", () => {
    const errors = validateAppOriginConfiguration({
      APP_RUNTIME_MODE: "production",
      APP_URL: "http://localhost:3000",
    });
    assert.ok(errors.some((error) => error.includes("cannot use localhost")));
    assert.ok(errors.some((error) => error.includes("must use https://")));
  });

  test("rejects conflicting server and public origins", () => {
    const errors = validateAppOriginConfiguration({
      APP_RUNTIME_MODE: "development",
      APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_APP_URL: "http://localhost:3001",
    });
    assert.ok(errors.some((error) => error.includes("must use the same origin")));
  });

  test("builds a localhost Clerk invitation redirect in development", () => {
    process.env.APP_RUNTIME_MODE = "development";
    process.env.APP_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    assert.equal(getInvitationRedirectUrl(), "http://localhost:3000/sign-up");
  });

  test("preserves the production Clerk invitation redirect", () => {
    process.env.APP_RUNTIME_MODE = "production";
    process.env.APP_URL = "https://tryedusentrix.app";
    process.env.NEXT_PUBLIC_APP_URL = "https://tryedusentrix.app";
    assert.equal(
      getInvitationRedirectUrl(),
      "https://tryedusentrix.app/sign-up"
    );
  });
});
