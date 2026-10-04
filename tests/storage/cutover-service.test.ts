import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { disableAutoIndexing } from "../regression/helpers/disable-auto-indexing";
import { stubServerOnly } from "../regression/helpers/stub-server-only";
import { createMockR2Port } from "./helpers/mock-r2";

stubServerOnly();
import type { StorageActor } from "@/lib/storage/types";
import { normalizePersistedAssetUrl, parseStoredAssetId } from "@/lib/storage/urls";

const DB_NAME = "stored_asset_cutover";
const SCHOOL_ID = "64b7f0c2a1d2e3f405060708";
const OTHER_SCHOOL = "64b7f0c2a1d2e3f405060799";

let mongod: MongoMemoryServer;
let StoredAsset: typeof import("@/models/StoredAsset").StoredAsset;
let service: typeof import("@/lib/storage/service");
let downloadSchemeImportFile: typeof import("@/lib/schemes/scheme-import-download").downloadSchemeImportFile;
let deleteUploadedFile: typeof import("@/lib/uploads/delete").deleteUploadedFile;

function actor(overrides: Partial<StorageActor> = {}): StorageActor {
  return {
    userId: new Types.ObjectId(),
    schoolId: new Types.ObjectId(SCHOOL_ID),
    roles: ["teacher"],
    ...overrides,
  };
}

before(
  async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.MONGO_DB_NAME = DB_NAME;
    ({ StoredAsset } = await import("@/models/StoredAsset"));
    service = await import("@/lib/storage/service");
    ({ downloadSchemeImportFile } = await import("@/lib/schemes/scheme-import-download"));
    ({ deleteUploadedFile } = await import("@/lib/uploads/delete"));
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

describe("association and domain auth", () => {
  test("associateStoredAsset rejects cross-school and peer hijack of a pending asset", async () => {
    const owner = actor();
    const peer = actor();
    const r2 = createMockR2Port();
    const pending = await service.presignUpload({
      actor: owner,
      kind: "teacher_document",
      fileName: "notes.pdf",
      mimeType: "application/pdf",
      r2,
    });
    const association = { type: "teacherDocument" as const, id: new Types.ObjectId().toHexString() };

    await assert.rejects(
      () =>
        service.associateStoredAsset({
          assetId: pending.assetId,
          schoolId: OTHER_SCHOOL,
          association,
          actor: owner,
        }),
      /across schools/
    );
    await assert.rejects(
      () =>
        service.associateStoredAsset({
          assetId: pending.assetId,
          schoolId: SCHOOL_ID,
          association,
          actor: peer,
        }),
      /Not allowed/
    );

    const associated = await service.associateStoredAsset({
      assetId: pending.assetId,
      schoolId: SCHOOL_ID,
      association,
      actor: owner,
    });
    assert.equal(associated.assetUrl, `/api/storage/assets/${pending.assetId}`);
    const stored = await StoredAsset.findById(pending.assetId);
    assert.equal(stored?.association?.type, "teacherDocument");
  });

  test("same-school teacher cannot read another teacher's private document", async () => {
    const owner = actor();
    const peer = actor();
    const r2 = createMockR2Port();
    const created = await service.createReadyAssetFromBytes({
      actor: owner,
      kind: "teacher_document",
      fileName: "private.pdf",
      mimeType: "application/pdf",
      body: Buffer.from("%PDF-private"),
      association: { type: "teacherDocument", id: new Types.ObjectId().toHexString() },
      r2,
    });
    await assert.rejects(
      () => service.grantAssetDownload({ actor: peer, assetId: created.assetId, r2 }),
      /Not allowed/
    );
    const ownerGrant = await service.grantAssetDownload({
      actor: owner,
      assetId: created.assetId,
      r2,
    });
    assert.ok(ownerGrant.redirectUrl.startsWith("https://r2.test/presign-get/"));
  });
});

describe("replacement, Leo put, scheme getObject, soft-delete-only", () => {
  test("replacement persists the new URL then soft-deletes the previous StoredAsset", async () => {
    const user = actor();
    const r2 = createMockR2Port();
    const previous = await service.createReadyAssetFromBytes({
      actor: user,
      kind: "student_avatar",
      fileName: "old.jpg",
      mimeType: "image/jpeg",
      body: Buffer.from("old-photo"),
      r2,
    });
    const next = await service.createReadyAssetFromBytes({
      actor: user,
      kind: "student_avatar",
      fileName: "new.jpg",
      mimeType: "image/jpeg",
      body: Buffer.from("new-photo"),
      r2,
    });
    const persisted = next.assetUrl;
    assert.ok(parseStoredAssetId(persisted));
    const deleted = await deleteUploadedFile(previous.assetUrl);
    assert.equal(deleted, true);
    assert.equal((await StoredAsset.findById(previous.assetId))?.status, "deleted");
    assert.equal((await StoredAsset.findById(next.assetId))?.status, "ready");
    assert.equal(r2.objects.has((await StoredAsset.findById(previous.assetId))!.storageKey), true);
  });

  test("deleteUploadedFile only accepts internal asset URLs", async () => {
    assert.equal(await deleteUploadedFile("https://utfs.io/f/abc"), false);
    assert.equal(await deleteUploadedFile("https://res.cloudinary.com/demo/image/upload/x.jpg"), false);
    assert.equal(await deleteUploadedFile("schools/abc/teacher_document/file.pdf"), false);
  });

  test("Leo server put creates a READY StoredAsset", async () => {
    const r2 = createMockR2Port();
    const created = await service.createReadyAssetFromBytes({
      actor: actor({ roles: ["school_admin"] }),
      kind: "lesson_illustration",
      fileName: "leo.png",
      mimeType: "image/png",
      body: Buffer.from("png-bytes"),
      r2,
    });
    assert.equal(created.status, "ready");
    assert.match(created.assetUrl, /^\/api\/storage\/assets\/[a-f0-9]{24}$/);
    assert.equal(r2.putCalls.length, 1);
    const stored = await StoredAsset.findById(created.assetId);
    assert.equal(stored?.status, "ready");
    assert.equal(stored?.kind, "lesson_illustration");
  });

  test("scheme import reads only in-school StoredAssets via getObject", async () => {
    const r2 = createMockR2Port();
    const created = await service.createReadyAssetFromBytes({
      actor: actor({ roles: ["school_admin"] }),
      kind: "scheme_import",
      fileName: "scheme.pdf",
      mimeType: "application/pdf",
      body: Buffer.from("%PDF-import"),
      r2,
    });
    const originalGet = r2.getObjectStream.bind(r2);
    r2.getObjectStream = async (key) => {
      process.env.R2_TEST_GET = key;
      return originalGet(key);
    };
    const downloaded = await downloadSchemeImportFile({
      fileUrl: created.assetUrl,
      schoolId: SCHOOL_ID,
      expectPdf: true,
      r2,
    });
    assert.equal(downloaded.ok, true);
    if (downloaded.ok) {
      assert.equal(downloaded.buffer.toString(), "%PDF-import");
    }

    const otherSchool = await downloadSchemeImportFile({
      fileUrl: created.assetUrl,
      schoolId: OTHER_SCHOOL,
      expectPdf: true,
      r2,
    });
    assert.equal(otherSchool.ok, false);

    const untrusted = await downloadSchemeImportFile({
      fileUrl: "https://utfs.io/f/abc",
      schoolId: SCHOOL_ID,
    });
    assert.equal(untrusted.ok, false);
  });

  test("calendar persistence rejects data URLs", () => {
    assert.throws(
      () => normalizePersistedAssetUrl("data:image/png;base64,AAAA", "Calendar cover"),
      /data URL/
    );
    assert.throws(
      () => normalizePersistedAssetUrl("https://example.com/cover.png", "Calendar cover"),
      /internal storage URL/
    );
    const id = "64b7f0c2a1d2e3f405060701";
    assert.equal(
      normalizePersistedAssetUrl(`/api/storage/assets/${id}`, "Calendar cover"),
      `/api/storage/assets/${id}`
    );
  });
});
