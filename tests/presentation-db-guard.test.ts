import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  PRESENTATION_DEMO_DB_NAME,
  assertPresentationDemoDatabase,
  resolvePresentationDatabaseName,
} from "../src/lib/demo/presentation-db-guard";

describe("presentation demo database guard", () => {
  test("accepts exactly edusentrix-demo", () => {
    assert.equal(PRESENTATION_DEMO_DB_NAME, "edusentrix-demo");
    assert.doesNotThrow(() =>
      assertPresentationDemoDatabase("edusentrix-demo")
    );
  });

  test("refuses any other name with the required message", () => {
    assert.throws(
      () => assertPresentationDemoDatabase("edusentrix"),
      /REFUSED: Presentation demo seeding can only run against edusentrix-demo\.\nCurrent database: edusentrix/
    );
  });

  test("refuses names that contain prod even if they also mismatch", () => {
    assert.throws(
      () => assertPresentationDemoDatabase("edusentrix-prod"),
      /REFUSED: Presentation demo seeding can only run against edusentrix-demo/
    );
    assert.throws(
      () => assertPresentationDemoDatabase("prod"),
      /Current database: prod/
    );
  });

  test("refuses an empty name", () => {
    assert.throws(
      () => assertPresentationDemoDatabase(""),
      /Current database: \(empty\)/
    );
  });

  test("resolves MONGO_DB_NAME first, matching connectToDatabase", () => {
    assert.equal(
      resolvePresentationDatabaseName({
        MONGO_DB_NAME: "edusentrix-demo",
        DEMO_MONGO_DB_NAME: "other",
        APP_RUNTIME_MODE: "demo",
        MONGODB_URI: "mongodb://localhost:27017/from-uri",
      } as NodeJS.ProcessEnv),
      "edusentrix-demo"
    );
  });

  test("resolves DEMO_MONGO_DB_NAME in demo mode when MONGO_DB_NAME is unset", () => {
    assert.equal(
      resolvePresentationDatabaseName({
        APP_RUNTIME_MODE: "demo",
        DEMO_MONGO_DB_NAME: "edusentrix-demo",
        MONGODB_URI: "mongodb://localhost:27017/from-uri",
      } as NodeJS.ProcessEnv),
      "edusentrix-demo"
    );
  });
});
