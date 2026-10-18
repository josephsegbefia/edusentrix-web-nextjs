import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import {
  connectToDatabase,
  isDatabaseAccessBlockedForBuild,
  NEXT_PRODUCTION_BUILD_PHASE,
} from "../src/db/connectToDatabase";

const originalNextPhase = process.env.NEXT_PHASE;
const originalMongoUri = process.env.MONGODB_URI;
const originalMongoDbName = process.env.MONGO_DB_NAME;

afterEach(() => {
  if (originalNextPhase === undefined) delete process.env.NEXT_PHASE;
  else process.env.NEXT_PHASE = originalNextPhase;
  if (originalMongoUri === undefined) delete process.env.MONGODB_URI;
  else process.env.MONGODB_URI = originalMongoUri;
  if (originalMongoDbName === undefined) delete process.env.MONGO_DB_NAME;
  else process.env.MONGO_DB_NAME = originalMongoDbName;
});

describe("database build isolation", () => {
  test("blocks database access before URI parsing or network connection during a Next build", async () => {
    process.env.NEXT_PHASE = NEXT_PRODUCTION_BUILD_PHASE;
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/should-not-connect";
    process.env.MONGO_DB_NAME = "should-not-connect";

    assert.equal(isDatabaseAccessBlockedForBuild(), true);
    await assert.rejects(
      () => connectToDatabase(),
      /database access is disabled during the Next production build phase/i
    );
  });

  test("does not classify ordinary runtime execution as a build", () => {
    delete process.env.NEXT_PHASE;
    assert.equal(isDatabaseAccessBlockedForBuild(), false);
  });
});
