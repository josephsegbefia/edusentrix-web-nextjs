import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeLessonContentBlocks } from "../src/lib/lessons/content-block-normalizer";

describe("normalizeLessonContentBlocks", () => {
  it("preserves advanced block metadata", () => {
    const blocks = normalizeLessonContentBlocks([
      {
        id: "math-1",
        type: "math_expression",
        bodyHtml: "",
        order: 0,
        aiGenerated: true,
        teacherReviewed: false,
        mathMeta: { latex: "\\frac{1}{2}", plainText: "One half" },
      },
      {
        id: "ill-1",
        type: "illustration",
        bodyHtml: "<p>Plant cell</p>",
        order: 1,
        resourceUrl: "https://utfs.io/f/abc.png",
        assetMeta: {
          source: "ai",
          assetStatus: "draft",
          required: true,
          altText: "Plant cell diagram",
          uploadThingKey: "key-123",
        },
      },
      {
        id: "diag-1",
        type: "diagram",
        bodyHtml: "",
        order: 2,
        diagramMeta: { diagramType: "fraction_bar", data: { numerator: 2, denominator: 3 } },
      },
    ]);

    assert.equal(blocks.length, 3);
    assert.equal(blocks[0]?.mathMeta?.latex, "\\frac{1}{2}");
    assert.equal(blocks[0]?.mathMeta?.validationStatus, "valid");
    assert.equal(blocks[1]?.assetMeta?.uploadThingKey, "key-123");
    assert.equal(blocks[2]?.diagramMeta?.diagramType, "fraction_bar");
  });
});
