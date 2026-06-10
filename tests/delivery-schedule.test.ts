import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pickLessonDeliveryForClass } from "../src/lib/lessons/pick-lesson-delivery";

describe("pickLessonDeliveryForClass", () => {
  const deliveries = [
    { _id: "d1", classGroupId: "class-a" },
    { _id: "d2", classGroupId: "class-b" },
  ];

  it("returns the requested class delivery when present", () => {
    const picked = pickLessonDeliveryForClass(deliveries, "class-a", "class-b");
    assert.equal(picked?._id, "d2");
  });

  it("falls back to anchor session class", () => {
    const picked = pickLessonDeliveryForClass(deliveries, "class-a", null);
    assert.equal(picked?._id, "d1");
  });
});
