/**
 * Runs the real migration script as a child process against a disposable
 * in-memory MongoDB. The child runs from an empty temp directory, so no
 * .env.local or .env can point it anywhere else.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, beforeEach, describe, test } from "node:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";

const ROOT = resolve(__dirname, "../..");
const SCRIPT = join(ROOT, "scripts/storage/normalize-student-avatar-metadata.ts");
const PROBE = join(ROOT, "tests/storage/helpers/dry-run-guard-probe.ts");
const TSX = join(ROOT, "node_modules/.bin/tsx");
const SCHOOL = new Types.ObjectId("64b7f0c2a1d2e3f405060708");
const DB = "avatar_script";

let mongod: MongoMemoryServer;
let client: InstanceType<typeof mongoose.mongo.MongoClient>;
let workDir: string;

function run(target: string, args: string[], env: Record<string, string> = {}) {
  const childEnv: Record<string, string> = {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    TSX_TSCONFIG_PATH: join(ROOT, "tsconfig.json"),
    MONGODB_URI: mongod.getUri(),
    MONGO_DB_NAME: DB,
    ...env,
  };
  const result = spawnSync(TSX, [target, ...args], {
    cwd: workDir,
    encoding: "utf8",
    timeout: 120_000,
    env: childEnv as NodeJS.ProcessEnv,
  });
  return { code: result.status, out: `${result.stdout}\n${result.stderr}` };
}

function db() {
  return client.db(DB);
}

/** Every collection's options, indexes, and documents. */
async function snapshot() {
  const collections = await db().listCollections().toArray();
  const out: Record<string, unknown> = {};
  for (const info of collections.sort((a, b) => a.name.localeCompare(b.name))) {
    const coll = db().collection(info.name);
    out[info.name] = {
      options: "options" in info ? info.options : null,
      indexes: await coll.listIndexes().toArray(),
      docs: await coll.find({}).sort({ _id: 1 }).toArray(),
    };
  }
  return JSON.parse(JSON.stringify(out));
}

async function seed() {
  const linkedStudent = new Types.ObjectId();
  const legacyStudent = new Types.ObjectId();
  const linked = new Types.ObjectId();
  const legacy = new Types.ObjectId();
  const alreadyPrivate = new Types.ObjectId();
  const asset = (_id: Types.ObjectId, visibility: string, association: unknown, kind = "student_avatar") => ({
    _id,
    schoolId: SCHOOL,
    kind,
    visibility,
    status: "ready",
    association,
    storageKey: `schools/${SCHOOL}/${String(_id)}.jpg`,
  });
  await db().collection("storedassets").insertMany([
    asset(linked, "public", { type: "student", id: linkedStudent }),
    asset(legacy, "public", null),
    asset(alreadyPrivate, "private", null),
    asset(new Types.ObjectId(), "public", null, "teacher_avatar"),
  ]);
  await db().collection("students").insertMany([
    { _id: linkedStudent, schoolId: SCHOOL, photoUrl: `/api/storage/assets/${linked}` },
    { _id: legacyStudent, schoolId: SCHOOL, photoUrl: `/api/storage/assets/${legacy}` },
    { _id: new Types.ObjectId(), schoolId: SCHOOL, photoUrl: null },
  ]);
  return { linked, legacy, legacyStudent, alreadyPrivate };
}

before(
  async () => {
    mongod = await MongoMemoryServer.create();
    client = new mongoose.mongo.MongoClient(mongod.getUri());
    await client.connect();
    workDir = mkdtempSync(join(tmpdir(), "avatar-script-"));
  },
  { timeout: 180_000 }
);

after(async () => {
  await client?.close();
  await mongod?.stop();
  rmSync(workDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await db().dropDatabase();
});

describe("normalize-student-avatar-metadata script", { timeout: 600_000 }, () => {
  test("dry run on a seeded database changes no document, index, or collection", async () => {
    await seed();
    const before = await snapshot();
    const { code, out } = run(SCRIPT, []);
    assert.equal(code, 0, out);
    assert.match(out, /DRY RUN \(read-only, writes blocked\)/);
    assert.match(out, /student_avatar assets:\s+3/);
    assert.match(out, /changes an apply would make:\s+2/);
    assert.match(out, /Dry run complete\. Nothing was written\./);
    assert.deepEqual(await snapshot(), before);
  });

  test("dry run on an empty database creates no collections or indexes", async () => {
    const { code, out } = run(SCRIPT, []);
    assert.equal(code, 0, out);
    assert.deepEqual(await db().listCollections().toArray(), []);
  });

  test("dry run ignores NODE_ENV", async () => {
    for (const nodeEnv of ["development", "test", "production"]) {
      const { code, out } = run(SCRIPT, [], { NODE_ENV: nodeEnv });
      assert.equal(code, 0, out);
      assert.deepEqual(await db().listCollections().toArray(), [], nodeEnv);
    }
  });

  test("the write guard blocks every write path, even with auto index and create on", () => {
    const { code, out } = run(PROBE, []);
    assert.equal(code, 0, out);
    const results = JSON.parse(out.trim().split("\n").find((line) => line.startsWith("{"))!);
    for (const [name, outcome] of Object.entries(results)) {
      if (name === "read.find") assert.equal(outcome, "written", "reads still work");
      else if (name === "collectionsAfter") assert.equal(outcome, "0");
      else assert.equal(outcome, "blocked", name);
    }
  });

  test("apply refuses without every confirmation and writes nothing", async () => {
    await seed();
    const before = await snapshot();
    const manifest = join(workDir, "refused.json");
    const attempts: Array<{ args: string[]; env: Record<string, string>; reason: RegExp }> = [
      { args: ["--apply", "--manifest", manifest, "--confirm-database", DB], env: {}, reason: /CONFIRM_STUDENT_AVATAR_MIGRATION=yes/ },
      {
        args: ["--apply", "--manifest", manifest],
        env: { CONFIRM_STUDENT_AVATAR_MIGRATION: "yes" },
        reason: /--confirm-database/,
      },
      {
        args: ["--apply", "--manifest", manifest, "--confirm-database", "production"],
        env: { CONFIRM_STUDENT_AVATAR_MIGRATION: "yes" },
        reason: /does not match the connected database "avatar_script"/,
      },
      {
        args: ["--apply", "--confirm-database", DB],
        env: { CONFIRM_STUDENT_AVATAR_MIGRATION: "yes" },
        reason: /--apply requires --manifest/,
      },
      {
        args: ["--rollback", manifest, "--confirm-database", DB],
        env: {},
        reason: /CONFIRM_STUDENT_AVATAR_MIGRATION=yes/,
      },
    ];
    for (const attempt of attempts) {
      const { code, out } = run(SCRIPT, attempt.args, attempt.env);
      assert.notEqual(code, 0, out);
      assert.match(out, attempt.reason);
      assert.equal(existsSync(manifest), false);
    }
    assert.deepEqual(await snapshot(), before);
  });

  test("a fully confirmed apply and rollback round-trip without building indexes", async () => {
    const s = await seed();
    const indexesBefore = (await snapshot()) as Record<string, { indexes: unknown }>;
    const manifest = join(workDir, `manifest-${Date.now()}.json`);
    const confirmed = { CONFIRM_STUDENT_AVATAR_MIGRATION: "yes" };

    const applied = run(SCRIPT, ["--apply", "--manifest", manifest, "--confirm-database", DB], confirmed);
    assert.equal(applied.code, 0, applied.out);
    assert.match(applied.out, /updated 2, skipped 0/);
    assert.equal(JSON.parse(readFileSync(manifest, "utf8")).entries.length, 2);
    const assets = db().collection("storedassets");
    assert.equal((await assets.findOne({ _id: s.legacy }))?.visibility, "private");
    assert.equal(String((await assets.findOne({ _id: s.legacy }))?.association?.id), String(s.legacyStudent));

    const after = (await snapshot()) as Record<string, { indexes: unknown }>;
    assert.deepEqual(Object.keys(after), Object.keys(indexesBefore));
    for (const name of Object.keys(after)) {
      assert.deepEqual(after[name].indexes, indexesBefore[name].indexes, name);
    }

    const rolled = run(SCRIPT, ["--rollback", manifest, "--confirm-database", DB], confirmed);
    assert.equal(rolled.code, 0, rolled.out);
    assert.match(rolled.out, /restored 2, skipped 0/);
    assert.equal((await assets.findOne({ _id: s.legacy }))?.visibility, "public");
    assert.equal((await assets.findOne({ _id: s.legacy }))?.association, null);
    assert.equal((await assets.findOne({ _id: s.alreadyPrivate }))?.visibility, "private");
  });
});
