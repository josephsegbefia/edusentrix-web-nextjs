import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapStudentPayloadBlocksToContentBlocks } from "../src/lib/lessons/student-content-renderer";

describe("mapStudentPayloadBlocksToContentBlocks", () => {
  it("maps illustration and diagram metadata for student rendering", () => {
    const blocks = mapStudentPayloadBlocksToContentBlocks([
      {
        id: "ill-1",
        type: "illustration",
        title: "Market",
        bodyHtml: "<p>Market scene</p>",
        order: 0,
        estimatedMinutes: null,
        resourceUrl: "https://utfs.io/f/abc.png",
        accessibilityMeta: { altText: "Busy market", caption: "Local market" },
      },
      {
        id: "diag-1",
        type: "diagram",
        title: "Fractions",
        bodyHtml: "",
        order: 1,
        estimatedMinutes: 5,
        diagramMeta: { diagramType: "fraction_bar", data: { numerator: 3, denominator: 4 } },
      },
    ]);

    assert.equal(blocks.length, 2);
    assert.equal(blocks[0]?.resourceUrl, "https://utfs.io/f/abc.png");
    assert.equal(blocks[0]?.assetMeta?.altText, "Busy market");
    assert.equal(blocks[1]?.diagramMeta?.diagramType, "fraction_bar");
    assert.equal(blocks[0]?.aiGenerated, false);
  });
});
