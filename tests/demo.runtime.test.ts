import assert from "node:assert/strict";
import { test, describe, beforeEach, afterEach } from "node:test";

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  delete process.env.APP_RUNTIME_MODE;
  delete process.env.NEXT_PUBLIC_APP_RUNTIME_MODE;
  delete process.env.DEMO_BASE_URL;
  delete process.env.DEMO_SESSION_SECRET;
  delete process.env.DEMO_DEFAULT_SESSION_MINUTES;
  delete process.env.DEMO_MAX_ACTIVE_SESSIONS;
  delete process.env.DEMO_UPLOADS_ENABLED;
  delete process.env.DEMO_AI_ENABLED;
  delete process.env.DEMO_AI_MAX_REQUESTS_PER_SESSION;
}

/**
 * We need a fresh module for each test because `DEMO_CONFIG` is evaluated at
 * import time.  Node's module cache makes this tricky, so we use a dynamic
 * `import()` with a cache-busting query param.
 */
let counter = 0;
async function freshRuntime() {
  counter++;
  const mod: typeof import("../src/lib/demo/runtime") = await import(
    `../src/lib/demo/runtime?v=${counter}`
  );
  return mod;
}

function fakeHeaders(host?: string): Headers {
  const h = new Headers();
  if (host) h.set("host", host);
  return h;
}

describe("isDemoMode", () => {
  beforeEach(resetEnv);
  afterEach(() => Object.assign(process.env, ORIGINAL_ENV));

  test("returns false when APP_RUNTIME_MODE is unset", async () => {
    const { isDemoMode } = await freshRuntime();
    assert.equal(isDemoMode(), false);
  });

  test("returns true when APP_RUNTIME_MODE is demo", async () => {
    process.env.APP_RUNTIME_MODE = "demo";
    const { isDemoMode } = await freshRuntime();
    assert.equal(isDemoMode(), true);
  });

  test("returns false when APP_RUNTIME_MODE is production", async () => {
    process.env.APP_RUNTIME_MODE = "production";
    const { isDemoMode } = await freshRuntime();
    assert.equal(isDemoMode(), false);
  });
});

describe("isDemoHost", () => {
  beforeEach(resetEnv);
  afterEach(() => Object.assign(process.env, ORIGINAL_ENV));

  test("returns false when DEMO_BASE_URL is unset", async () => {
    const { isDemoHost } = await freshRuntime();
    assert.equal(isDemoHost({ headers: fakeHeaders("demo.tryedusentrix.app") }), false);
  });

  test("matches hostname from full URL env var", async () => {
    process.env.DEMO_BASE_URL = "https://demo.tryedusentrix.app";
    const { isDemoHost } = await freshRuntime();
    assert.equal(isDemoHost({ headers: fakeHeaders("demo.tryedusentrix.app") }), true);
  });

  test("matches hostname from bare domain env var", async () => {
    process.env.DEMO_BASE_URL = "demo.tryedusentrix.app";
    const { isDemoHost } = await freshRuntime();
    assert.equal(isDemoHost({ headers: fakeHeaders("demo.tryedusentrix.app") }), true);
  });

  test("strips port from host header", async () => {
    process.env.DEMO_BASE_URL = "https://demo.tryedusentrix.app";
    const { isDemoHost } = await freshRuntime();
    assert.equal(isDemoHost({ headers: fakeHeaders("demo.tryedusentrix.app:3000") }), true);
  });

  test("returns false for production host", async () => {
    process.env.DEMO_BASE_URL = "https://demo.tryedusentrix.app";
    const { isDemoHost } = await freshRuntime();
    assert.equal(isDemoHost({ headers: fakeHeaders("tryedusentrix.app") }), false);
  });

  test("returns false when host header is missing", async () => {
    process.env.DEMO_BASE_URL = "https://demo.tryedusentrix.app";
    const { isDemoHost } = await freshRuntime();
    assert.equal(isDemoHost({ headers: fakeHeaders() }), false);
  });

  test("case-insensitive matching", async () => {
    process.env.DEMO_BASE_URL = "https://Demo.TryEduSentrix.App";
    const { isDemoHost } = await freshRuntime();
    assert.equal(isDemoHost({ headers: fakeHeaders("demo.tryedusentrix.app") }), true);
  });
});

describe("isClientDemoMode", () => {
  beforeEach(resetEnv);
  afterEach(() => Object.assign(process.env, ORIGINAL_ENV));

  test("returns false when NEXT_PUBLIC_APP_RUNTIME_MODE is unset", async () => {
    const { isClientDemoMode } = await freshRuntime();
    assert.equal(isClientDemoMode(), false);
  });

  test("returns true when NEXT_PUBLIC_APP_RUNTIME_MODE is demo", async () => {
    process.env.NEXT_PUBLIC_APP_RUNTIME_MODE = "demo";
    const { isClientDemoMode } = await freshRuntime();
    assert.equal(isClientDemoMode(), true);
  });
});

describe("collection-registry", () => {
  test("deleteOrderedCollections returns leaf-first", async () => {
    const { deleteOrderedCollections } = await import(
      "../src/lib/demo/collection-registry"
    );
    const ordered = deleteOrderedCollections();
    assert.ok(ordered.length > 20, `Expected > 20 entries, got ${ordered.length}`);
    for (let i = 1; i < ordered.length; i++) {
      assert.ok(
        ordered[i]!.deleteOrder >= ordered[i - 1]!.deleteOrder,
        `deleteOrder not ascending at index ${i}`
      );
    }
  });

  test("seedOrderedCollections returns root-first", async () => {
    const { seedOrderedCollections } = await import(
      "../src/lib/demo/collection-registry"
    );
    const ordered = seedOrderedCollections();
    for (let i = 1; i < ordered.length; i++) {
      assert.ok(
        ordered[i]!.seedOrder >= ordered[i - 1]!.seedOrder,
        `seedOrder not ascending at index ${i}`
      );
    }
  });

  test("isRegisteredDemoCollection finds known models", async () => {
    const { isRegisteredDemoCollection } = await import(
      "../src/lib/demo/collection-registry"
    );
    assert.equal(isRegisteredDemoCollection("Student"), true);
    assert.equal(isRegisteredDemoCollection("Invoice"), true);
    assert.equal(isRegisteredDemoCollection("UserMembership"), true);
    assert.equal(isRegisteredDemoCollection("BankBranch"), false);
    assert.equal(isRegisteredDemoCollection("NotAModel"), false);
  });
});
