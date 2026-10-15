import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { stubServerOnly } from "../regression/helpers/stub-server-only";

stubServerOnly();

function assertConnectionBefore(source: string, databaseOperation: string) {
  const connectionIndex = source.indexOf("await connectToDatabase()");
  const operationIndex = source.indexOf(databaseOperation);
  assert.notEqual(connectionIndex, -1, "route must connect to MongoDB");
  assert.notEqual(operationIndex, -1, `route must contain ${databaseOperation}`);
  assert.ok(connectionIndex < operationIndex, "MongoDB connection must precede model access");
}

describe("platform bootstrap corrective pass", () => {
  test("all bootstrap APIs connect before their first MongoDB operation", () => {
    const send = readFileSync(
      "src/app/api/platform/bootstrap/otp/send/route.ts",
      "utf8"
    );
    const verify = readFileSync(
      "src/app/api/platform/bootstrap/otp/verify/route.ts",
      "utf8"
    );
    const create = readFileSync(
      "src/app/api/platform/bootstrap/create/route.ts",
      "utf8"
    );

    assertConnectionBefore(send, "PlatformBootstrapOtp.countDocuments");
    assertConnectionBefore(verify, "PlatformBootstrapOtp.findOne");
    assertConnectionBefore(create, "PlatformBootstrapSession.findOne");
  });

  test("keeps the verified bootstrap session at two minutes", async () => {
    const { BOOTSTRAP_SESSION_TTL_MS } = await import(
      "../../src/lib/platform-bootstrap/config"
    );
    assert.equal(BOOTSTRAP_SESSION_TTL_MS, 2 * 60 * 1000);
  });

  test("returns a specific session-expired instruction", () => {
    const create = readFileSync(
      "src/app/api/platform/bootstrap/create/route.ts",
      "utf8"
    );
    assert.match(
      create,
      /Your verified bootstrap session expired\. Please verify the OTP again\./
    );
  });

  test("safe diagnostics omit raw error messages", async () => {
    const { buildPlatformBootstrapFailureMetadata } = await import(
      "../../src/lib/platform-bootstrap/diagnostics"
    );
    const metadata = buildPlatformBootstrapFailureMetadata({
      route: "/api/platform/bootstrap/otp/send",
      stage: "otp_send",
      error: Object.assign(new Error("mongodb://user:password@example"), {
        code: "ETIMEOUT",
      }),
    });
    assert.equal(metadata.errorType, "Error");
    assert.equal(metadata.errorCode, "ETIMEOUT");
    assert.doesNotMatch(JSON.stringify(metadata), /password|mongodb:\/\//);
  });

  test("OTP responses never expose the generated code", () => {
    const send = readFileSync(
      "src/app/api/platform/bootstrap/otp/send/route.ts",
      "utf8"
    );
    assert.doesNotMatch(send, /_debugCode/);
  });

  test("safe diagnostics reject secret-shaped error codes", async () => {
    const { buildPlatformBootstrapFailureMetadata } = await import(
      "../../src/lib/platform-bootstrap/diagnostics"
    );
    const metadata = buildPlatformBootstrapFailureMetadata({
      route: "/api/platform/bootstrap/create",
      stage: "create",
      error: { name: "Error", code: "mongodb://user:password@example" },
    });
    assert.equal(metadata.errorCode, null);
    assert.doesNotMatch(JSON.stringify(metadata), /password|mongodb:\/\//);
  });
});
