import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dedupeFlashcardCandidates,
  findDuplicateFlashcardIds,
  flashcardsAreDuplicates,
  parseLeoFlashcardResponse,
  sanitizeFlashcardPair,
} from "../src/lib/lessons/flashcard-generation";

describe("flashcard-generation", () => {
  it("detects near-duplicate weather element cards", () => {
    const a = {
      front: "What are the key weather elements we learned about in today's lesson?",
      back: "Temperature, humidity, and wind.",
    };
    const b = {
      front: "What are the three key weather elements we learned about?",
      back: "The three key weather elements are temperature, humidity, and wind.",
    };
    assert.equal(flashcardsAreDuplicates(a, b), true);
  });

  it("keeps genuinely different cards", () => {
    const a = {
      front: "What is humidity?",
      back: "The amount of water vapour in the air.",
    };
    const b = {
      front: "How is weather different from climate?",
      back: "Weather is daily conditions; climate is the long-term average.",
    };
    assert.equal(flashcardsAreDuplicates(a, b), false);
  });

  it("dedupes a batch down to unique cards only", () => {
    const candidates = [
      {
        front: "What are the three key weather elements we studied today?",
        back: "Temperature, humidity, and wind.",
      },
      {
        front: "What are the key weather elements we learned about today?",
        back: "Temperature, humidity, and wind affect our weather experience.",
      },
      {
        front: "How is weather different from climate?",
        back: "Weather changes day to day; climate is the average over many years.",
      },
    ];

    const { unique, skipped } = dedupeFlashcardCandidates(candidates, []);
    assert.equal(unique.length, 2);
    assert.equal(skipped, 1);
    assert.ok(unique.some((card) => /weather different from climate/i.test(card.front)));
    assert.ok(unique.some((card) => /weather elements/i.test(card.front)));
  });

  it("rejects cards that already exist in the deck", () => {
    const existing = [
      {
        front: "Define temperature in weather studies.",
        back: "How hot or cold the air is.",
      },
    ];
    const { unique, skipped } = dedupeFlashcardCandidates(
      [
        {
          front: "What does temperature mean in weather?",
          back: "It tells us how hot or cold the air is.",
        },
      ],
      existing,
    );
    assert.equal(unique.length, 0);
    assert.equal(skipped, 1);
  });

  it("sanitizes and caps flashcard length", () => {
    const sanitized = sanitizeFlashcardPair({
      front: "What is wind?",
      back: "Wind is the movement of air. ".repeat(20),
    });
    assert.ok(sanitized);
    assert.ok(sanitized!.back.length <= 200);
  });

  it("finds duplicate card ids in deck order", () => {
    const ids = findDuplicateFlashcardIds([
      {
        id: "a",
        front: "What are the three key weather elements we studied today?",
        back: "Temperature, humidity, and wind.",
      },
      {
        id: "b",
        front: "What are the key weather elements we learned about today?",
        back: "Temperature, humidity, and wind affect our weather experience.",
      },
      {
        id: "c",
        front: "How is weather different from climate?",
        back: "Weather changes day to day; climate is the average over many years.",
      },
    ]);
    assert.deepEqual(ids, ["b"]);
  });

  it("parses Leo JSON card payloads", () => {
    const parsed = parseLeoFlashcardResponse({
      cards: [
        { front: "What is condensation?", back: "Gas turning into liquid water droplets." },
        { front: "", back: "missing front" },
      ],
    });
    assert.equal(parsed.length, 1);
    assert.match(parsed[0]!.front, /condensation/i);
  });
});
