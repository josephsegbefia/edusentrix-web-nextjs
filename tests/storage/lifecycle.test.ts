import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { disableAutoIndexing } from "../regression/helpers/disable-auto-indexing";
import { createMockR2Port } from "./helpers/mock-r2";
import type { StorageActor } from "@/lib/storage/types";

const DB_NAME = "stored_asset_lifecycle";
const SCHOOL_ID = "64b7f0c2a1d2e3f405060708";
const OTHER_SCHOOL = "64b7f0c2a1d2e3f405060799";

let mongod: MongoMemoryServer;
let StoredAsset: typeof import("@/models/StoredAsset").StoredAsset;
let service: typeof import("@/lib/storage/service");

function actor(overrides: Partial<StorageActor> = {}): StorageActor {
  return {
    userId: new Types.ObjectId(),
    schoolId: new Types.ObjectId(SCHOOL_ID),
    roles: ["teacher"],
    ...overrides,
  };
}

async function seedReadyAsset(input: {
  status?: "pending" | "ready" | "deleted" | "failed";
  visibility?: "public" | "private";
  schoolId?: string;
  key?: string;
}) {
  return StoredAsset.create({
    schoolId: new Types.ObjectId(input.schoolId ?? SCHOOL_ID),
    uploadedByUserId: new Types.ObjectId(),
    provider: "r2",
    storageKey: input.key ?? `schools/${SCHOOL_ID}/pending/notice_attachment/${crypto.randomUUID()}.pdf`,
    fileName: "notice.pdf",
    extension: "pdf",
    mimeType: "application/pdf",
    sizeBytes: input.status === "ready" || input.status === "deleted" ? 12 : 0,
    kind: "notice_attachment",
    visibility: input.visibility ?? "private",
    status: input.status ?? "ready",
  });
}

before(
  async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.MONGO_DB_NAME = DB_NAME;
    ({ StoredAsset } = await import("@/models/StoredAsset"));
    service = await import("@/lib/storage/service");
    disableAutoIndexing();
    const { connectToDatabase } = await import("@/db/connectToDatabase");
    await connectToDatabase();
    await StoredAsset.collection.createIndex({ storageKey: 1 }, { unique: true });
  },
  { timeout: 180_000 }
);

after(async () => {
  await mongoose.disconnect().catch(() => undefined);
  await mongod?.stop();
});

beforeEach(async () => {
  await mongoose.connection.db!.dropDatabase();
  await StoredAsset.collection.createIndex({ storageKey: 1 }, { unique: true });
});

describe("StoredAsset model", () => {
  test("declares statuses, unique storageKey, and no duplicate index definitions", () => {
    const statusEnum = StoredAsset.schema.path("status").options.enum;
    assert.deepEqual(statusEnum, ["pending", "ready", "deleted", "failed"]);
    assert.notEqual(StoredAsset.schema.path("storageKey").options.unique, true);

    const indexes = StoredAsset.schema.indexes();
    const keys = indexes.map(([key]) => Object.keys(key).join(","));
    assert.ok(keys.includes("storageKey"));
    assert.equal(keys.filter((key) => key === "storageKey").length, 1);
    assert.ok(keys.includes("schoolId,status"));
    assert.ok(keys.includes("purgeAfter"));
  });

  test("soft-delete metadata fields exist", async () => {
    const doc = await seedReadyAsset({ status: "ready" });
    doc.status = "deleted";
    doc.deletedAt = new Date();
    doc.purgeAfter = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await doc.save();
    assert.equal(doc.status, "deleted");
    assert.ok(doc.deletedAt);
    assert.ok(doc.purgeAfter);
  });
});

describe("presign and complete", () => {
  test("caller cannot choose the key or school and receives only an internal asset URL", async () => {
    const r2 = createMockR2Port();
    const result = await service.presignUpload({
      actor: actor(),
      kind: "teacher_document",
      fileName: "contract-jane@school.edu.pdf",
      mimeType: "application/pdf",
      r2,
    });
    assert.match(result.assetId, /^[a-f0-9]{24}$/);
    assert.equal(result.assetUrl, `/api/storage/assets/${result.assetId}`);
    assert.equal(result.expiresInSeconds, 120);
    assert.ok(result.uploadUrl.startsWith("https://r2.test/presign-put/"));
    assert.equal("storageKey" in result, false);
    assert.ok(!JSON.stringify(result).includes("cloudflarestorage"));

    const stored = await StoredAsset.findById(result.assetId);
    assert.equal(String(stored?.schoolId), SCHOOL_ID);
    assert.equal(stored?.status, "pending");
    assert.ok(stored?.storageKey.startsWith(`schools/${SCHOOL_ID}/`));
    assert.ok(!stored?.storageKey.includes("jane@school.edu"));
    assert.ok(!String(stored?.fileName).includes("/"));
  });

  test("rejects token-gated kinds on the authenticated foundation path", async () => {
    await assert.rejects(
      () =>
        service.presignUpload({
          actor: actor(),
          kind: "admission_document",
          fileName: "birth.pdf",
          mimeType: "application/pdf",
          r2: createMockR2Port(),
        }),
      /not available on the authenticated storage route/
    );
  });

  test("HEAD validates size and type; missing, oversized, and MIME mismatches fail", async () => {
    const user = actor();
    const r2 = createMockR2Port();
    const pending = await service.presignUpload({
      actor: user,
      kind: "expense_receipt",
      fileName: "receipt.jpg",
      mimeType: "image/jpeg",
      r2,
    });
    const asset = await StoredAsset.findById(pending.assetId);
    assert.ok(asset);

    await assert.rejects(
      () => service.completeUpload({ actor: user, assetId: pending.assetId, r2 }),
      /not found/
    );
    assert.equal((await StoredAsset.findById(pending.assetId))?.status, "failed");

    const pending2 = await service.presignUpload({
      actor: user,
      kind: "expense_receipt",
      fileName: "receipt.jpg",
      mimeType: "image/jpeg",
      r2,
    });
    const asset2 = await StoredAsset.findById(pending2.assetId);
    r2.objects.set(asset2!.storageKey, {
      body: new Uint8Array(9 * 1024 * 1024),
      contentType: "image/jpeg",
      etag: '"big"',
    });
    await assert.rejects(
      () => service.completeUpload({ actor: user, assetId: pending2.assetId, r2 }),
      /exceeds the allowed size/
    );
    assert.equal(r2.deletedKeys.includes(asset2!.storageKey), true);

    const pending3 = await service.presignUpload({
      actor: user,
      kind: "expense_receipt",
      fileName: "receipt.jpg",
      mimeType: "image/jpeg",
      r2,
    });
    const asset3 = await StoredAsset.findById(pending3.assetId);
    r2.objects.set(asset3!.storageKey, {
      body: new Uint8Array([1, 2, 3]),
      contentType: "application/pdf",
      etag: '"pdf"',
    });
    await assert.rejects(
      () => service.completeUpload({ actor: user, assetId: pending3.assetId, r2 }),
      /file type/
    );
  });

  test("successful complete is idempotent and rejects the wrong school", async () => {
    const user = actor();
    const r2 = createMockR2Port();
    const pending = await service.presignUpload({
      actor: user,
      kind: "notice_attachment",
      fileName: "memo.pdf",
      mimeType: "application/pdf",
      r2,
    });
    const asset = await StoredAsset.findById(pending.assetId);
    r2.objects.set(asset!.storageKey, {
      body: new Uint8Array([1, 2, 3, 4]),
      contentType: "application/pdf",
      etag: '"ok"',
    });
    const first = await service.completeUpload({ actor: user, assetId: pending.assetId, r2 });
    const second = await service.completeUpload({ actor: user, assetId: pending.assetId, r2 });
    assert.equal(first.status, "ready");
    assert.equal(second.status, "ready");
    assert.equal(first.sizeBytes, 4);

    await assert.rejects(
      () =>
        service.completeUpload({
          actor: actor({ schoolId: new Types.ObjectId(OTHER_SCHOOL) }),
          assetId: pending.assetId,
          r2,
        }),
      /Not allowed/
    );
  });
});

describe("download and recovery", () => {
  test("pending, failed, and deleted assets are not downloadable", async () => {
    const r2 = createMockR2Port();
    const pending = await seedReadyAsset({ status: "pending" });
    const failed = await seedReadyAsset({ status: "failed" });
    const deleted = await seedReadyAsset({ status: "deleted" });
    const user = actor();
    await assert.rejects(
      () => service.grantAssetDownload({ actor: user, assetId: String(pending._id), r2 }),
      /not found/i
    );
    await assert.rejects(
      () => service.grantAssetDownload({ actor: user, assetId: String(failed._id), r2 }),
      /not found/i
    );
    await assert.rejects(
      () => service.grantAssetDownload({ actor: user, assetId: String(deleted._id), r2 }),
      /not found/i
    );
  });

  test("private assets require same-school authorization; public uses the gateway", async () => {
    const r2 = createMockR2Port();
    const privateAsset = await seedReadyAsset({ status: "ready", visibility: "private" });
    const publicAsset = await seedReadyAsset({
      status: "ready",
      visibility: "public",
      key: `schools/${SCHOOL_ID}/branding/logo/${crypto.randomUUID()}.png`,
    });
    await publicAsset.updateOne({ mimeType: "image/png", fileName: "logo.png", extension: "png" });

    await assert.rejects(
      () => service.grantAssetDownload({ actor: null, assetId: String(privateAsset._id), r2 }),
      /Not allowed/
    );
    const allowed = await service.grantAssetDownload({
      actor: actor(),
      assetId: String(privateAsset._id),
      r2,
    });
    assert.ok(allowed.redirectUrl.startsWith("https://r2.test/presign-get/"));
    assert.equal(allowed.expiresInSeconds, 120);

    const publicGrant = await service.grantAssetDownload({
      actor: null,
      assetId: String(publicAsset._id),
      r2,
    });
    assert.ok(publicGrant.redirectUrl.startsWith("https://r2.test/presign-get/"));

    const stored = await StoredAsset.findById(privateAsset._id);
    assert.ok(!JSON.stringify(stored?.toObject()).includes("https://r2.test"));
    assert.ok(!JSON.stringify(stored?.toObject()).includes("r2.cloudflarestorage.com"));
  });

  test("soft delete sets purgeAfter and restore checks the object still exists", async () => {
    const r2 = createMockR2Port();
    const user = actor();
    const asset = await seedReadyAsset({ status: "ready" });
    r2.objects.set(asset.storageKey, {
      body: new Uint8Array([1]),
      contentType: "application/pdf",
      etag: '"1"',
    });

    const deleted = await service.softDeleteAsset({ actor: user, assetId: String(asset._id) });
    assert.equal(deleted.status, "deleted");
    const afterDelete = await StoredAsset.findById(asset._id);
    assert.equal(afterDelete?.status, "deleted");
    assert.ok(afterDelete?.deletedAt);
    assert.ok(afterDelete?.purgeAfter);
    assert.ok(afterDelete!.purgeAfter!.getTime() > Date.now());
    assert.equal(r2.objects.has(asset.storageKey), true);

    const restored = await service.restoreAsset({
      actor: user,
      assetId: String(asset._id),
      r2,
    });
    assert.equal(restored.status, "ready");
    assert.equal(restored.assetUrl, `/api/storage/assets/${asset._id}`);
    const afterRestore = await StoredAsset.findById(asset._id);
    assert.equal(afterRestore?.status, "ready");
    assert.equal(afterRestore?.deletedAt, null);

    await service.softDeleteAsset({ actor: user, assetId: String(asset._id) });
    r2.objects.delete(asset.storageKey);
    await assert.rejects(
      () => service.restoreAsset({ actor: user, assetId: String(asset._id), r2 }),
      /no longer available/
    );
  });
});
