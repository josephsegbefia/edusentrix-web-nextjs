import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTeachingDeckFromSessionInput } from "../src/lib/lessons/build-teaching-deck-shared";
import { filterStudentVisibleContentBlocks } from "../src/lib/lessons/content-readiness";

describe("lesson content blocks compatibility", () => {
  it("keeps legacy teach deck behaviour", () => {
    const deck = buildTeachingDeckFromSessionInput({
      title: "Fractions",
      scheduledDate: "2026-02-10",
      startTime: "09:00",
      endTime: "09:40",
      contentBlocks: [
        {
          id: "b1",
          type: "explanation",
          title: "Intro",
          bodyHtml: "<p>Fractions</p>",
          order: 0,
          aiGenerated: false,
          teacherReviewed: true,
        },
      ],
    });

    assert.equal(deck.slides[0]?.type, "title");
    assert.equal(deck.slides[1]?.type, "content_block");
    assert.equal(deck.slides.at(-1)?.type, "timer");
  });

  it("hides asset_plan from student-visible blocks", () => {
    const visible = filterStudentVisibleContentBlocks([
      {
        id: "plan",
        type: "asset_plan",
        bodyHtml: "<p>Need diagram</p>",
        order: 0,
        aiGenerated: true,
        teacherReviewed: false,
      },
      {
        id: "explain",
        type: "explanation",
        bodyHtml: "<p>Hello</p>",
        order: 1,
        aiGenerated: false,
        teacherReviewed: true,
      },
    ]);

    assert.equal(visible.length, 1);
    assert.equal(visible[0]?.type, "explanation");
  });
});
