/**
 * Non-destructive R2 connectivity smoke test.
 *
 * Uses the R2.1 config/client only. Does not connect to Mongo, does not
 * create StoredAsset records, and deletes the `_smoke/` object before exit.
 *
 * Usage:
 *   npx tsx scripts/smoke-r2-connectivity.ts
 *
 * Never prints credentials or presigned URLs.
 */
import { resolve } from "path";
import { randomUUID } from "crypto";
import { getR2Config } from "../src/lib/storage/config";
import { createR2Port } from "../src/lib/storage/r2";

const BODY = "EduSentrix R2 connectivity test";
const CONTENT_TYPE = "text/plain";

type StepName =
  | "CONFIG"
  | "PUT"
  | "HEAD"
  | "HEAD VERIFY"
  | "SIGNED GET"
  | "CONTENT VERIFY"
  | "DELETE"
  | "POST-DELETE HEAD";

function safeError(error: unknown): string {
  if (!error || typeof error !== "object") {
    return error instanceof Error ? error.message : "unknown error";
  }
  const record = error as {
    name?: string;
    message?: string;
    Code?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const parts = [
    record.name,
    record.Code ?? record.code,
    record.$metadata?.httpStatusCode != null
      ? `http ${record.$metadata.httpStatusCode}`
      : null,
    record.message,
  ].filter((part): part is string | number => Boolean(part));
  const text = parts.join(" | ");
  return text
    .replace(/https?:\/\/[^\s]+/gi, "[redacted-url]")
    .replace(/AKIA[A-Z0-9]{8,}/g, "[redacted]")
    .replace(/[A-Za-z0-9+/]{32,}={0,2}/g, "[redacted]");
}

function fail(step: StepName, error: unknown): never {
  console.error(`FAILED at ${step}`);
  console.error(safeError(error));
  process.exit(1);
}

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local") });
  config({ path: resolve(process.cwd(), ".env") });

  let cfg;
  try {
    cfg = getR2Config();
  } catch (error) {
    fail("CONFIG", error);
  }

  let endpointHost = "unknown";
  try {
    endpointHost = new URL(cfg.endpoint).host;
  } catch {
    fail("CONFIG", new Error("R2_ENDPOINT is not a valid URL"));
  }

  const r2 = createR2Port();
  const key = `_smoke/${randomUUID()}.txt`;
  const body = Buffer.from(BODY, "utf8");
  let uploaded = false;
  let deleted = false;

  const cleanup = async () => {
    if (!uploaded || deleted) return;
    try {
      await r2.deleteObject(key);
      deleted = true;
    } catch {
      // Best-effort leftover cleanup; the failure path already reported.
    }
  };

  try {
    try {
      await r2.putObject({ key, body, contentType: CONTENT_TYPE });
      uploaded = true;
    } catch (error) {
      fail("PUT", error);
    }

    let head;
    try {
      head = await r2.headObject(key);
    } catch (error) {
      fail("HEAD", error);
    }

    try {
      if (!head.exists) {
        throw new Error("object does not exist after PUT");
      }
      if (head.contentLength !== body.byteLength) {
        throw new Error("size mismatch");
      }
      const type = (head.contentType ?? "").split(";")[0]?.trim().toLowerCase();
      if (type !== CONTENT_TYPE) {
        throw new Error("content-type mismatch");
      }
    } catch (error) {
      fail("HEAD VERIFY", error);
    }

    let signedUrl: string;
    try {
      const signed = await r2.createPresignedGet({
        key,
        expiresInSeconds: cfg.signedUrlTtlSeconds,
        contentDisposition: "attachment; filename=\"smoke.txt\"",
        contentType: CONTENT_TYPE,
      });
      signedUrl = signed.url;
    } catch (error) {
      fail("SIGNED GET", error);
    }

    let fetched: Buffer;
    try {
      const response = await fetch(signedUrl);
      if (!response.ok) {
        throw new Error(`signed GET http ${response.status}`);
      }
      fetched = Buffer.from(await response.arrayBuffer());
    } catch (error) {
      fail("SIGNED GET", error);
    }

    try {
      if (!fetched.equals(body)) {
        throw new Error("downloaded bytes do not match uploaded content");
      }
    } catch (error) {
      fail("CONTENT VERIFY", error);
    }

    try {
      await r2.deleteObject(key);
      deleted = true;
    } catch (error) {
      fail("DELETE", error);
    }

    try {
      const after = await r2.headObject(key);
      if (after.exists) {
        throw new Error("object still exists after DELETE");
      }
    } catch (error) {
      fail("POST-DELETE HEAD", error);
    }

    console.log("R2_CONNECTIVITY_CONFIRMED");
    console.log(`Bucket name: ${cfg.bucket}`);
    console.log(`Endpoint host: ${endpointHost}`);
    console.log("PUT: PASS");
    console.log("HEAD: PASS");
    console.log("SIGNED GET: PASS");
    console.log("CONTENT VERIFY: PASS");
    console.log("DELETE: PASS");
    console.log("POST-DELETE HEAD: PASS");
    console.log("Residual test objects: 0");
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  fail("CONFIG", error);
});
