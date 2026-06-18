import { LESSON_CONTENT_BLOCK_TYPES, type LessonSubjectMode } from "@/types/lesson-content-blocks";

export function buildSubjectAwareGenerationRules(subjectMode: LessonSubjectMode): string {
  const blockTypes = JSON.stringify(LESSON_CONTENT_BLOCK_TYPES);

  const base = `Return JSON only:
{
  "contentBlocks": [
    {
      "type": one of ${blockTypes},
      "title": string,
      "bodyHtml": string (HTML using <p>, <ul>, <li>, <strong>, <em> only),
      "order": number (0-based),
      "estimatedMinutes": number (optional),
      "aiGenerated": true,
      "teacherReviewed": false,
      "resourceUrl": string | null,
      "subjectMode": string (optional),
      "languageMeta": object (optional),
      "mathMeta": object (optional),
      "assetMeta": object (optional),
      "diagramMeta": object (optional),
      "accessibilityMeta": object (optional)
    }
  ]
}`;

  switch (subjectMode) {
    case "ghanaian_language":
      return `${base}
Ghanaian Language Mode rules:
- Use bilingual_text, vocabulary, pronunciation, activity, and check blocks where helpful.
- Set languageMeta.requiresLanguageReview=true and languageReviewStatus="needs_review" on language blocks.
- Include English support text where mediumOfInstruction is english_supported or bilingual.
- Do not auto-approve local-language spelling.`;
    case "mathematics":
      return `${base}
Mathematics Mode rules:
- Use math_expression and worked_example blocks for key maths (not only explanation/example).
- Put LaTeX in mathMeta.latex and a plain explanation in mathMeta.plainText.
- For worked_example, include mathMeta.steps with step plainText and latex where useful.
- Use diagram blocks with diagramMeta for fraction_bar, number_line, or angle when visuals help.
- Do not store fractions only in bodyHtml.`;
    case "science_visual":
    case "visual_heavy":
      return `${base}
Visual-heavy Mode rules:
- Prefer asset_plan blocks before attaching final visuals.
- Include at least one asset_plan describing required diagrams/illustrations.
- You may include illustration blocks with assetMeta.source="ai", assetStatus="draft", and generationPrompt — teachers must approve before publish.
- Use diagram blocks with structured diagramMeta for precise maths/science diagrams.
- Required visuals must include assetMeta.required=true and a suggested altText draft.`;
    default:
      return base;
  }
}
