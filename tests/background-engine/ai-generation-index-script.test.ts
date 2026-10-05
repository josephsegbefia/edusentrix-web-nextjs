/**
 * Proves scripts/ensure-ai-generation-indexes.ts is safe: dry run by default,
 * --apply never drops or mutates documents, duplicates block apply without
 * printing idempotency keys, and re-running is a no-op.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { disableAutoIndexing } from "../regression/helpers/disable-auto-indexing";

const DB_NAME = "ai_generation_index_script";
const SCRIPT = path.resolve(process.cwd(), "scripts/ensure-ai-generation-indexes.ts");
const run = promisify(execFile);
const SENSITIVE_KEY = "ai-lesson:session:schoolA:sessionB:1";

let mongod: MongoMemoryServer;
let script: typeof import("../../scripts/ensure-ai-generation-indexes");

before(
  async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.MONGO_DB_NAME = DB_NAME;
    script = await import("../../scripts/ensure-ai-generation-indexes");
    disableAutoIndexing();
    const { connectToDatabase } = await import("../../src/db/connectToDatabase");
    await connectToDatabase();
  },
  { timeout: 180_000 }
);

after(async () => {
  await mongoose.disconnect().catch(() => undefined);
  await mongod?.stop();
});

beforeEach(async () => {
  await mongoose.connection.db!.dropDatabase();
});

const db = () => mongoose.connection.db!;
const generation = () => db().collection("lessonaigenerationrequests");
const illustration = () => db().collection("lessonillustrationrequests");

async function dbState() {
  const collections = (await db().listCollections().toArray()).map((c) => c.name).sort();
  const state: Record<string, { count: number; indexes: unknown[] }> = {};
  for (const name of collections) {
    state[name] = {
      count: await db().collection(name).countDocuments(),
      indexes: await db().collection(name).indexes(),
    };
  }
  return JSON.parse(JSON.stringify(state)) as typeof state;
}

function cli(...args: string[]) {
  return run(process.execPath, ["--import", "tsx", SCRIPT, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, MONGODB_URI: mongod.getUri(), MONGO_DB_NAME: DB_NAME },
  });
}

function assertNoSensitiveOutput(text: string) {
  assert.doesNotMatch(text, new RegExp(SENSITIVE_KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(text, /contentBlocks|generationPrompt|sk-[a-zA-Z0-9]|password=/i);
}

describe("AI generation index script", () => {
  test("dry-run creates nothing and reports missing indexes", async () => {
    const dry = await cli();
    assert.match(dry.stdout, /DRY RUN/);
    assert.match(dry.stdout, /MISSING\s+LessonAiGenerationRequest \{schoolId,idempotencyKey\}/);
    assert.match(dry.stdout, /MISSING\s+LessonIllustrationRequest \{schoolId,idempotencyKey\}/);
    assert.doesNotMatch(dry.stdout, /CREATED/);
    assertNoSensitiveOutput(dry.stdout);
    assert.equal((await db().listCollections().toArray()).length, 0);
  });

  test("apply creates both unique indexes; rerun reports PRESENT", async () => {
    const first = await script.applyAiGenerationIndexes();
    assert.equal(first.applied, true);
    assert.ok(first.created.includes("unique_lesson_ai_generation_idempotency"));
    assert.ok(first.created.includes("unique_lesson_illustration_idempotency"));

    const generationIndex = (await generation().indexes()).find(
      (i) => i.name === "unique_lesson_ai_generation_idempotency"
    );
    const illustrationIndex = (await illustration().indexes()).find(
      (i) => i.name === "unique_lesson_illustration_idempotency"
    );
    assert.equal(generationIndex?.unique, true);
    assert.deepEqual(generationIndex?.key, { schoolId: 1, idempotencyKey: 1 });
    assert.equal(illustrationIndex?.unique, true);
    assert.deepEqual(illustrationIndex?.key, { schoolId: 1, idempotencyKey: 1 });

    const again = await script.applyAiGenerationIndexes();
    assert.equal(again.applied, true);
    assert.deepEqual(again.created, []);
    assert.ok(again.inspection.targets.every((t) => t.status === "present"));
  });

  test("duplicates block apply without printing the idempotency key", async () => {
    const schoolId = new mongoose.Types.ObjectId();
    const firstId = new mongoose.Types.ObjectId();
    const secondId = new mongoose.Types.ObjectId();
    await generation().insertMany([
      { _id: firstId, schoolId, idempotencyKey: SENSITIVE_KEY },
      { _id: secondId, schoolId, idempotencyKey: SENSITIVE_KEY },
    ]);
    const before = await dbState();

    const inspection = await script.inspectAiGenerationIndexes();
    const unique = inspection.targets.find((t) =>
      t.label.startsWith("LessonAiGenerationRequest")
    );
    assert.equal(unique?.status, "missing");
    assert.equal(unique?.duplicates.length, 1);
    assert.equal(unique?.duplicates[0]?.count, 2);
    assert.equal(inspection.blocked, true);

    const result = await script.applyAiGenerationIndexes();
    assert.equal(result.applied, false);
    assert.deepEqual(await dbState(), before);

    const dry = await cli();
    assert.match(dry.stdout, /duplicates: 1 group, 2 documents/);
    assert.match(dry.stdout, /BLOCKED/);
    assertNoSensitiveOutput(dry.stdout);
    await assert.rejects(cli("--apply"), (error: unknown) => {
      const err = error as { stdout?: string; stderr?: string; message?: string };
      const output = `${err.stdout ?? ""}\n${err.stderr ?? ""}\n${err.message ?? ""}`;
      assert.match(output, /Refusing to apply/);
      assertNoSensitiveOutput(output);
      return true;
    });
    assert.deepEqual(await dbState(), before);
  });

  test("a conflicting same-key index is reported and never dropped", async () => {
    await generation().createIndex(
      { schoolId: 1, idempotencyKey: 1 },
      { name: "schoolId_1_idempotencyKey_1" }
    );
    const before = await dbState();
    const inspection = await script.inspectAiGenerationIndexes();
    const unique = inspection.targets.find((t) =>
      t.label.startsWith("LessonAiGenerationRequest")
    )!;
    assert.equal(unique.status, "conflict");
    assert.ok(unique.differences.includes("unique"));
    assert.equal(inspection.blocked, true);
    const result = await script.applyAiGenerationIndexes();
    assert.equal(result.applied, false);
    assert.deepEqual(await dbState(), before);
  });

  test("unrelated indexes and documents are untouched", async () => {
    const schoolId = new mongoose.Types.ObjectId();
    await generation().insertOne({
      schoolId,
      idempotencyKey: "ai-lesson:session:ok:1",
      prompt: "should-not-appear-in-output",
    });
    await illustration().insertOne({
      schoolId,
      idempotencyKey: "ai-illustration:ok:1",
    });
    await generation().createIndex({ teacherUserId: 1 }, { name: "unrelated_teacher_idx" });
    const docsBefore = await generation().find({}).toArray();
    const before = await dbState();

    const first = await cli("--apply");
    assert.match(first.stdout, /CREATED\s+"unique_lesson_ai_generation_idempotency"/);
    assert.match(first.stdout, /CREATED\s+"unique_lesson_illustration_idempotency"/);
    assertNoSensitiveOutput(first.stdout);
    assert.doesNotMatch(first.stdout, /should-not-appear-in-output/);

    const after = await dbState();
    assert.deepEqual(await generation().find({}).toArray(), docsBefore);
    for (const [name, state] of Object.entries(before)) {
      for (const index of state.indexes) {
        assert.ok(
          after[name].indexes.some((i) => JSON.stringify(i) === JSON.stringify(index)),
          `pre-existing index preserved: ${name} ${JSON.stringify(index)}`
        );
      }
    }
  });
});
