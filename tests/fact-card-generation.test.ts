import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dedupeFactCardCandidates,
  factCardsAreDuplicates,
  parseLeoFactCardResponse,
} from "../src/lib/lessons/fact-card-generation";

describe("fact-card-generation", () => {
  it("detects repeated fact hooks", () => {
    const a = {
      fact: "Did you know humidity measures water vapour in the air?",
      detail: "Humidity tells us how much moisture is in the air around us.",
    };
    const b = {
      fact: "Did you know that humidity measures moisture in the air?",
      detail: "It helps explain why some days feel hotter than others.",
    };
    assert.equal(factCardsAreDuplicates(a, b), true);
  });

  it("dedupes generated fact cards against existing deck", () => {
    const existing = [
      {
        fact: "Weather and climate are not the same thing.",
        detail: "Weather changes daily while climate is measured over many years.",
      },
    ];
    const candidates = [
      existing[0]!,
      {
        fact: "Ghana's rainy season brings more humidity to the air.",
        detail: "During the rainy season, moist air from the ocean moves inland.",
        tags: ["weather"],
      },
    ];
    const { unique, skipped } = dedupeFactCardCandidates(
      candidates.map((c) => ({ ...c, tags: "tags" in c ? c.tags : [] })),
      existing,
    );
    assert.equal(unique.length, 1);
    assert.equal(skipped, 1);
    assert.match(unique[0]!.fact, /rainy season/i);
  });

  it("parses optional illustration suggestion fields", () => {
    const parsed = parseLeoFactCardResponse({
      factCards: [
        {
          fact: "Thermometers measure air temperature with a liquid or digital sensor.",
          detail: "Temperature readings help forecasters understand daily weather changes.",
          tags: ["weather"],
          illustrationSuggested: true,
          illustrationPrompt: "Simple classroom thermometer diagram with Celsius scale",
        },
      ],
    });
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0]!.illustrationSuggested, true);
    assert.match(parsed[0]!.illustrationPrompt ?? "", /thermometer/i);
  });
});
