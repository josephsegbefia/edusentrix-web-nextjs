import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getLessonSessionReadiness } from "../src/lib/lessons/content-readiness";
import type { LessonContentBlock } from "../src/types/lesson-content-blocks";

describe("content-readiness", () => {
  it("blocks publish for unreviewed AI illustration drafts", () => {
    const blocks: LessonContentBlock[] = [
      {
        id: "1",
        type: "illustration",
        title: "Market scene",
        bodyHtml: "<p>Market</p>",
        order: 0,
        aiGenerated: true,
        teacherReviewed: false,
        resourceUrl: "https://example.com/image.png",
        assetMeta: {
          required: true,
          source: "ai",
          assetStatus: "draft",
          altText: "A busy market scene",
        },
      },
    ];

    const readiness = getLessonSessionReadiness(blocks);
    assert.equal(readiness.canPublish, false);
    assert.ok(
      readiness.blockingReasons.some((reason) => reason.includes("AI-generated illustration")),
    );
  });

  it("allows publish when AI illustration is approved with alt text", () => {
    const blocks: LessonContentBlock[] = [
      {
        id: "1",
        type: "illustration",
        title: "Market scene",
        bodyHtml: "<p>Market</p>",
        order: 0,
        aiGenerated: true,
        teacherReviewed: true,
        resourceUrl: "https://example.com/image.png",
        assetMeta: {
          required: true,
          source: "ai",
          assetStatus: "approved",
          altText: "A busy market scene",
        },
      },
    ];

    const readiness = getLessonSessionReadiness(blocks);
    assert.equal(readiness.canPublish, true);
  });
});
