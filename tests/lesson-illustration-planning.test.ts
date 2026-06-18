import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildImageGenerationPrompt,
  buildScenePlannerUserPrompt,
  parseIllustrationScenePlan,
} from "../src/lib/lessons/lesson-illustration-planning";

const SAMPLE_GENERATION_PROMPT = `Create a bright educational infographic poster for JHS students in Ghana titled "Temperature can vary greatly in Ghana!"

Show that temperature differs between regions in Ghana. Split the illustration into two clear sides:

Left side: Northern Ghana, hot and dry. Show a bright sun, dry savannah landscape, dusty ground, a Ghanaian child shielding their face from the heat, and traditional northern-style buildings in the background. Add a label: "Northern Ghana" and a thermometer showing "35–40°C" with the words "Hot and dry".

Right side: Coastal Ghana, warm and breezy. Show a beach/coastal scene with blue sea, waves, palm trees, clouds, and a Ghanaian child looking comfortable in light clothing. Add a label: "Coastal Ghana" and a thermometer showing "24–28°C" with the words "Warm and breezy".

In the middle, place a simple map of Ghana with a warm-to-cool colour gradient from north to south. Label Tamale in the north and Accra near the coast.

Style: colourful, classroom-friendly, clean infographic, semi-realistic educational illustration, accurate Ghana context, readable labels, child-safe, high-resolution, no clutter.`;

describe("lesson-illustration-planning", () => {
  it("builds fact-card planner prompt with hook and detail", () => {
    const prompt = buildScenePlannerUserPrompt({
      sessionTitle: "Weather in Ghana",
      fact: "Temperature can vary greatly across Ghana!",
      detail:
        "In Ghana, temperatures can be much higher in the northern regions compared to coastal areas.",
    });

    assert.match(prompt, /Temperature can vary greatly across Ghana!/);
    assert.match(prompt, /northern regions/);
    assert.match(prompt, /designer commission/);
  });

  it("parses a valid scene plan with generationPrompt", () => {
    const plan = parseIllustrationScenePlan({
      generationPrompt: SAMPLE_GENERATION_PROMPT,
      posterTitle: "Temperature can vary greatly in Ghana!",
      layoutType: "split_compare",
      sceneBrief:
        "Split poster comparing hot northern savannah and cool coastal Ghana with a central map gradient.",
      keyVisualElements: [
        "Ghana map outline",
        "sun over north",
        "sea waves on coast",
        "Northern Ghana label",
        "Coastal Ghana label",
      ],
      topCaption: "In Ghana, the temperature can differ significantly between regions.",
      bottomCaption:
        "Remember: Different temperatures in different places affect the clothes we wear.",
      avoid: ["random classroom", "unrelated animals"],
    });

    assert.ok(plan);
    assert.equal(plan?.layoutType, "split_compare");
    assert.match(plan?.generationPrompt ?? "", /Northern Ghana/);
    assert.equal(plan?.keyVisualElements.length, 5);
  });

  it("builds PNG image model prompt from generation brief", () => {
    const plan = parseIllustrationScenePlan({
      generationPrompt: SAMPLE_GENERATION_PROMPT,
      posterTitle: "Temperature can vary greatly in Ghana!",
      layoutType: "split_compare",
      sceneBrief: "Split map comparing hot north and cool coast.",
      keyVisualElements: ["Ghana map", "sun icon", "sea breeze lines"],
      topCaption: "Regional temperature differences matter.",
      bottomCaption: "Remember: dress for your local weather.",
      avoid: ["text paragraphs"],
    });
    assert.ok(plan);

    const imagePrompt = buildImageGenerationPrompt(plan!);
    assert.match(imagePrompt, /Northern Ghana/);
    assert.match(imagePrompt, /polished PNG educational infographic/);
    assert.match(imagePrompt, /semi-realistic educational illustration/);
    assert.match(imagePrompt, /Remember: dress for your local weather/);
  });
});
