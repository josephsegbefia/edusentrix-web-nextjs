import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTeachingDeckFromSessionInput } from "../src/lib/lessons/build-teaching-deck-shared";

describe("buildTeachingDeckFromSessionInput", () => {
  it("builds title, content, and wrap-up slides", () => {
    const deck = buildTeachingDeckFromSessionInput({
      title: "Weather — Session 1",
      scheduledDate: "2026-02-10",
      startTime: "09:00",
      endTime: "09:40",
      contentBlocks: [
        {
          id: "b1",
          type: "explanation",
          title: "Introduction",
          bodyHtml: "<p>Cloud types</p>",
          order: 0,
          aiGenerated: true,
          teacherReviewed: false,
        },
      ],
    });

    assert.equal(deck.slides[0]?.type, "title");
    assert.equal(deck.slides[1]?.type, "content_block");
    assert.equal(deck.slides.at(-1)?.type, "timer");
    assert.ok(deck.slides.length >= 3);
  });

  it("maps diagram blocks with diagramMeta for teach slides", () => {
    const deck = buildTeachingDeckFromSessionInput({
      title: "Fractions",
      scheduledDate: "2026-02-10",
      startTime: "09:00",
      endTime: "09:40",
      contentBlocks: [
        {
          id: "d1",
          type: "diagram",
          title: "Two thirds",
          bodyHtml: "",
          order: 0,
          aiGenerated: false,
          teacherReviewed: true,
          diagramMeta: { diagramType: "fraction_bar", data: { numerator: 2, denominator: 3 } },
        },
      ],
    });

    const contentSlide = deck.slides[1];
    assert.equal(contentSlide?.contentBlockType, "diagram");
    assert.equal(contentSlide?.diagramMeta?.diagramType, "fraction_bar");
  });
});
