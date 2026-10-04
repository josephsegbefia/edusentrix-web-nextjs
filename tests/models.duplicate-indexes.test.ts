/**
 * Guards against duplicate Mongoose schema index declarations (the
 * "Duplicate schema index on {...}" startup warnings). Imports every model;
 * no database connection is made.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import mongoose from "mongoose";

const MODELS_DIR = path.resolve(process.cwd(), "src/models");

/**
 * Duplicates whose declarations differ semantically. They are intentionally
 * left unchanged until reviewed; resolving one must remove it from this list.
 */
const NEEDS_REVIEW = [
  "LeoResponseCache {\"expiresAt\":1}",
  "PromotionCycle {\"idempotencyKey\":1}",
];

/** Pre-existing compound duplicates Mongoose does not warn about; out of scope. */
const KNOWN_COMPOUND = [
  "SubjectGrade {\"studentId\":1,\"academicPeriodId\":1,\"subjectId\":1}",
  "SubscriptionAddOn {\"schoolId\":1,\"addonType\":1}",
];

const FIXED: Array<{ model: string; field: string; unique: boolean }> = [
  { model: "AuditStreamHead", field: "streamKey", unique: true },
  { model: "ExploreContentSnapshot", field: "generationKey", unique: false },
  { model: "PaymentAllocation", field: "paymentId", unique: false },
  { model: "PaymentAllocation", field: "invoiceLineItemId", unique: false },
  { model: "PaymentIntent", field: "idempotencyKey", unique: true },
  { model: "PlatformBillingSettings", field: "key", unique: true },
  { model: "StudentExploreRecord", field: "contentSnapshotId", unique: false },
];

const duplicateWarnings: string[] = [];

before(async () => {
  process.removeAllListeners("warning");
  process.on("warning", (warning) => {
    const match = /Duplicate schema index on (\{.*?\})/.exec(warning.message);
    if (match) duplicateWarnings.push(match[1]);
  });
  for (const file of fs.readdirSync(MODELS_DIR).filter((f) => f.endsWith(".ts")).sort()) {
    await import(path.join(MODELS_DIR, file));
  }
  await new Promise((resolve) => setImmediate(resolve));
});

function indexesOn(modelName: string, keyFields: string) {
  return mongoose
    .model(modelName)
    .schema.indexes()
    .filter(([key]) => Object.keys(key).join(",") === keyFields);
}

describe("schema index declarations", () => {
  test("each previously duplicated index is declared exactly once with its options preserved", () => {
    for (const { model, field, unique } of FIXED) {
      const declared = indexesOn(model, field);
      assert.equal(declared.length, 1, `${model}.${field} declared once`);
      const [key, options] = declared[0];
      assert.deepEqual(key, { [field]: 1 });
      assert.equal(Boolean(options.unique), unique, `${model}.${field} unique=${unique}`);
      assert.equal(options.sparse, undefined);
      assert.equal(options.partialFilterExpression, undefined);
      assert.equal(options.expireAfterSeconds, undefined);
    }
  });

  test("no model has duplicate index keys outside the reviewed allowlist", () => {
    const duplicates: string[] = [];
    for (const name of mongoose.modelNames().sort()) {
      const counts = new Map<string, number>();
      for (const [key] of mongoose.model(name).schema.indexes()) {
        const id = `${name} ${JSON.stringify(key)}`;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      for (const [id, count] of counts) if (count > 1) duplicates.push(id);
    }
    assert.deepEqual(duplicates.sort(), [...NEEDS_REVIEW, ...KNOWN_COMPOUND].sort());
  });

  test("the only remaining Mongoose duplicate-index warnings are the NEEDS_REVIEW items", () => {
    assert.deepEqual(duplicateWarnings.sort(), ["{\"expiresAt\":1}", "{\"idempotencyKey\":1}"]);
  });
});
