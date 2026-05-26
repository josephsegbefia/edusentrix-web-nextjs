import type { ExploreGenerationMode } from "@/lib/learn/explore/explore-types";
import type { ResolvedExploreGenerationContext } from "@/lib/learn/explore/explore-types";

export const EXPLORE_AI_PROMPT_VERSION = "explore_v2_lazy_1";

/** JSON field contract echoed in the system prompt (validated server-side with Zod). */
export const EXPLORE_AI_JSON_SCHEMA_HINT = `{
  "title": string,
  "subjectName": string,
  "sourceLessonTitle": string,
  "gradeName": string,
  "difficulty": "easy" | "standard" | "stretch",
  "estimatedMinutes": number (6-20),
  "missionType": "detective" | "field_trip" | "story_lab" | "maker_challenge" | "culture_link" | "home_lab" | "career_link" | "ghana_connection" | "future_world" | "mistake_buster" | "leo_rescue" | "parent_challenge",
  "adventureAngle": string,
  "studentPromise": string,
  "intro": string,
  "category": "based_on_lesson" | "go_deeper",
  "deepDiveExplanation": { "title", "conceptBridge", "deeperExplanation", "realWorldConnection" },
  "misconceptions": [{ "id", "misconception", "whyStudentsThinkThis", "leoCorrection", "quickCheckPrompt" }] (1-4),
  "tryItActivity": { "id", "title", "type", "safetyLevel", "instructions", "reflectionPrompt" } (optional),
  "parentConversationPrompt": { "title", "prompt", "expectedLearningOutcome" } (optional),
  "curiosityPathways": [{ "id", "label", "description", "nextAdventurePrompt" }] (1-4),
  "vocabulary": [{ "id", "word", "meaning", "simpleExample", "pronunciation"? }] (1-8),
  "readingTasks": [{ "id", "title", "passage", "readingLevel", "questions" }] (1-4, optional),
  "funFacts": [{ "id", "headline", "fact", "whyItMatters" }] (2-6, optional),
  "checkpoints": [{ "id", "type", "prompt" }] (optional),
  "endingQuiz": { "id", "title", "questions": [{ "id", "prompt", "options": [{ "id", "letter", "label" }], "correctOptionId", "explanation" }] } (4-6 questions, options A-D unique),
  "leoPrompts": string[] (2-6, optional)
}`;

export function buildExploreSystemPrompt() {
  return `You are Leo, the EduSentrix Learn AI companion for Ghanaian school students.
Generate a safe Explore adventure from APPROVED CLASS LESSON CONTEXT only.

Critical rules:
1. Do NOT repeat, rewrite, or paraphrase the class lesson notes or teacher content provided under "ALREADY TAUGHT IN CLASS".
2. Go DEEPER with age-safe real-life examples, likely misconceptions with gentle corrections, and reflection — not a second class lesson.
3. Stay strictly within the student's grade/class level (${"use the gradeName provided"}).
4. Use simple, encouraging, vivid language suitable for children and young teens.
5. Use Ghanaian/African examples where natural and respectful (school, community, farms, markets, weather, local industry).
6. Do NOT include: unsafe experiments, adult/sexual content, graphic violence, political persuasion, religious persuasion, bullying, shaming, harmful instructions, or dangerous challenges.
7. Do NOT include external links, URLs, emails, phone numbers, or social media handles.
8. Do NOT claim the teacher already approved this content.
9. Do NOT complete homework or give final assignment answers — teach understanding instead.
10. Include at least one misconception with a kind correction.
11. Include deepDiveExplanation with a realWorldConnection.
12. The endingQuiz must test the NEW Explore content (readings/fun facts/deeper ideas), NOT the original class notes.
13. Return STRICT JSON ONLY matching this schema (no markdown, no commentary):
${EXPLORE_AI_JSON_SCHEMA_HINT}`;
}

export type ExplorePromptBuildInput = {
  context: ResolvedExploreGenerationContext;
  mode: ExploreGenerationMode;
};

export function buildExploreUserPrompt(input: ExplorePromptBuildInput) {
  const { context, mode } = input;
  const flashcardHints =
    context.flashcardHints.length > 0
      ? context.flashcardHints.map((c) => c.front).join(", ")
      : "none";

  const related =
    context.relatedLessonTitles.length > 0
      ? context.relatedLessonTitles.map((t) => `- ${t}`).join("\n")
      : "- none";

  const modeLine =
    mode === "go_deeper" || mode === "recommended"
      ? "go_deeper — category must be \"go_deeper\", at least 2 readingTasks on different angles, at least 3 funFacts"
      : mode === "mistake_buster"
        ? "mistake_buster — focus on common misconceptions and gentle corrections"
        : mode === "challenge"
          ? "challenge — stretch difficulty with still age-safe content"
          : mode;

  return `Create one Explore adventure.

Grade: ${context.gradeName}
Subject: ${context.subjectName}
Lesson topic: ${context.lessonTitle}
Curriculum: ${context.curriculum ?? "school curriculum"}
Academic year: ${context.academicYearName ?? "current"} | Term: ${context.termName ?? "current"}
Mode: ${modeLine}

ALREADY TAUGHT IN CLASS (do NOT repeat or paraphrase — only use to know what to skip):
${context.lessonBrief.classroomBrief}

Teacher plan notes (optional): ${context.lessonBrief.planNotes || "none"}

Flashcard topic words (inspiration only — do not copy definitions): ${flashcardHints}

RELATED LESSONS IN THIS SUBJECT (use a DIFFERENT angle, titles, fun facts, and quiz than these):
${related}`;
}

export function buildExploreRepairSystemPrompt() {
  return `You are Leo's Explore content safety editor for EduSentrix Learn.
Rewrite ONLY the problematic parts of the JSON adventure while keeping the same overall schema and lesson topic.
Rules: school-safe, age-appropriate, no external links, no homework answers, no lesson repetition, Ghana-friendly tone.
Return the FULL corrected JSON object only (same top-level keys as the input).`;
}

export function buildExploreRepairUserPrompt(input: {
  contentJson: string;
  failedChecks: string[];
  lessonTitle: string;
  gradeName: string;
}) {
  return `Fix this Explore adventure JSON for grade "${input.gradeName}" and lesson "${input.lessonTitle}".

Failed safety checks:
${input.failedChecks.map((c) => `- ${c}`).join("\n")}

Current JSON:
${input.contentJson}`;
}

export function buildExplorePromptPair(input: ExplorePromptBuildInput) {
  return {
    systemPrompt: buildExploreSystemPrompt(),
    userPrompt: buildExploreUserPrompt(input),
    promptVersion: EXPLORE_AI_PROMPT_VERSION,
    summary: `Lazy Explore v2 for ${input.context.lessonTitle} (${input.mode})`,
  };
}
