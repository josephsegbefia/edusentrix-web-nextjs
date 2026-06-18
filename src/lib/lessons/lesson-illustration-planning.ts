export type IllustrationScenePlan = {
  /** Full detailed brief passed to the illustration generator. */
  generationPrompt: string;
  posterTitle: string;
  layoutType: "split_compare" | "labeled_diagram" | "process_steps" | "map_focus" | "single_scene";
  sceneBrief: string;
  keyVisualElements: string[];
  topCaption?: string;
  bottomCaption?: string;
  avoid: string[];
};

export const SCENE_PLANNER_SYSTEM = `You are Leo, writing detailed illustration briefs for Ghanaian basic-school (Primary/JHS) educational infographics.
Output valid JSON only:
{
  "generationPrompt": string,
  "posterTitle": string,
  "layoutType": "split_compare" | "labeled_diagram" | "process_steps" | "map_focus" | "single_scene",
  "sceneBrief": string,
  "keyVisualElements": string[],
  "topCaption": string | null,
  "bottomCaption": string | null,
  "avoid": string[]
}

Your main deliverable is "generationPrompt": a COMPLETE, detailed commission brief (500-1400 words) that an illustrator can follow exactly.

The generationPrompt MUST be structured like a professional educational poster brief:
1. Opening line: "Create a bright educational infographic poster for JHS students in Ghana titled …"
2. One paragraph stating what the poster must teach (grounded in the fact card).
3. Layout section with explicit regions (left/right/top/bottom/center) and what appears in EACH region.
4. Specific labels, numbers, thermometer readings, place names, or short headings to show — spell them out verbatim.
5. Characters/scenes only when they support the fact (e.g. child reacting to heat vs cool breeze).
6. Ghana-accurate context: landscapes, architecture, clothing, geography where relevant.
7. topCaption: 1-3 sentences from the fact detail for the top of the poster (or null).
8. bottomCaption: a short "Remember:" takeaway for the bottom (or null).
9. Style closing line: colourful, classroom-friendly, clean infographic, readable labels, child-safe, no clutter.

layoutType guide:
- split_compare: contrasting two sides (hot north vs cool coast, wet vs dry season, etc.)
- map_focus: map of Ghana or region as central teaching device
- labeled_diagram: parts of a system (water cycle, plant, instrument)
- process_steps: numbered steps in order
- single_scene: one focused scene when comparison is not needed

Rules:
- Read the FULL fact hook and detail. The poster must teach that exact idea — not a generic topic image.
- Be SPECIFIC and VISUAL. Name colours, positions, icons, and every label.
- keyVisualElements: 5-10 concrete items that MUST appear.
- avoid: generic classrooms, unrelated mascots, logos, frightening imagery, off-topic decoration.
- Do NOT be brief. The generationPrompt should read like the example brief teachers would give to a designer.`;

export function parseIllustrationScenePlan(data: unknown): IllustrationScenePlan | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;

  const generationPrompt =
    typeof row.generationPrompt === "string" ? row.generationPrompt.trim() : "";
  if (!generationPrompt || generationPrompt.length < 280) return null;

  const posterTitle = typeof row.posterTitle === "string" ? row.posterTitle.trim() : "";
  const sceneBrief = typeof row.sceneBrief === "string" ? row.sceneBrief.trim() : "";
  if (!posterTitle || !sceneBrief || sceneBrief.length < 20) return null;

  const layoutRaw = row.layoutType;
  const layoutType =
    layoutRaw === "split_compare" ||
    layoutRaw === "labeled_diagram" ||
    layoutRaw === "process_steps" ||
    layoutRaw === "map_focus" ||
    layoutRaw === "single_scene"
      ? layoutRaw
      : "single_scene";

  const keyVisualElements = Array.isArray(row.keyVisualElements)
    ? row.keyVisualElements
        .map((item) => String(item).trim())
        .filter(Boolean)
        .slice(0, 12)
    : [];
  if (keyVisualElements.length < 3) return null;

  const topCaption =
    typeof row.topCaption === "string" && row.topCaption.trim()
      ? row.topCaption.trim().slice(0, 600)
      : undefined;
  const bottomCaption =
    typeof row.bottomCaption === "string" && row.bottomCaption.trim()
      ? row.bottomCaption.trim().slice(0, 400)
      : undefined;

  const avoid = Array.isArray(row.avoid)
    ? row.avoid
        .map((item) => String(item).trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];

  return {
    generationPrompt: generationPrompt.slice(0, 6000),
    posterTitle: posterTitle.slice(0, 220),
    layoutType,
    sceneBrief: sceneBrief.slice(0, 900),
    keyVisualElements,
    topCaption,
    bottomCaption,
    avoid,
  };
}

export function buildScenePlannerUserPrompt(input: {
  fact?: string;
  detail?: string;
  prompt?: string;
  sessionTitle?: string;
}): string {
  if (input.fact?.trim() && input.detail?.trim()) {
    return [
      "Write a detailed infographic illustration brief for this Did You Know fact card.",
      input.sessionTitle ? `Lesson/session: ${input.sessionTitle}` : "",
      "",
      `Fact hook: ${input.fact.trim()}`,
      `Detail: ${input.detail.trim()}`,
      input.prompt?.trim()
        ? `Optional earlier hint (use only if aligned with the fact): ${input.prompt.trim()}`
        : "",
      "",
      "The generationPrompt must be long, specific, and visual — like a designer commission.",
      "If the fact compares regions, seasons, or contrasts, prefer layoutType split_compare or map_focus.",
      "Include exact label text, temperature ranges, place names, or other numbers when the fact supports them.",
      "Pull topCaption and bottomCaption from the fact detail where possible.",
    ]
      .filter((line) => line !== undefined)
      .join("\n");
  }

  const prompt = input.prompt?.trim();
  if (!prompt) return "";

  return [
    "Write a detailed infographic illustration brief for this lesson asset request.",
    input.sessionTitle ? `Lesson/session: ${input.sessionTitle}` : "",
    `Teacher request: ${prompt}`,
    "The generationPrompt must be long, specific, and visual — like a designer commission.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildImageGenerationPrompt(plan: IllustrationScenePlan): string {
  return [
    plan.generationPrompt,
    "",
    `Required visual elements: ${plan.keyVisualElements.join("; ")}.`,
    plan.topCaption ? `Top text on poster: ${plan.topCaption}` : "",
    plan.bottomCaption ? `Bottom remember box: ${plan.bottomCaption}` : "",
    plan.avoid.length > 0 ? `Avoid: ${plan.avoid.join("; ")}.` : "",
    "",
    "Output: a single polished PNG educational infographic poster for Ghanaian JHS students.",
    "Style: colourful, classroom-friendly, clean infographic, semi-realistic educational illustration, accurate Ghana context, readable labels, child-safe, high-resolution, no clutter, no watermarks, no logos.",
  ]
    .filter(Boolean)
    .join("\n");
}
