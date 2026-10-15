import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { stubServerOnly } from "../regression/helpers/stub-server-only";

stubServerOnly();

describe("scheduled MongoDB execution boundary", () => {
  test("connects before executing the scheduled handler", async () => {
    const { createDatabaseBackedScheduleRunner } = await import(
      "../../src/lib/background/scheduled-handler"
    );
    const calls: string[] = [];
    const run = createDatabaseBackedScheduleRunner(async () => {
      calls.push("connect");
    });

    const result = await run(async () => {
      calls.push("query");
      return "reconciled";
    });

    assert.equal(result, "reconciled");
    assert.deepEqual(calls, ["connect", "query"]);
  });

  test("propagates connection failure and never executes the handler", async () => {
    const { createDatabaseBackedScheduleRunner } = await import(
      "../../src/lib/background/scheduled-handler"
    );
    let handlerCalled = false;
    const run = createDatabaseBackedScheduleRunner(async () => {
      throw new Error("database unavailable");
    });

    await assert.rejects(
      run(async () => {
        handlerCalled = true;
        return "unexpected";
      }),
      /database unavailable/
    );
    assert.equal(handlerCalled, false);
  });
});
