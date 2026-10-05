import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const SYNC_PATHS = [
  "src/app/api/learn/mobile/tutor/chat/route.ts",
  "src/app/api/learn/mobile/leo/hint/route.ts",
  "src/app/api/teacher/lesson-notes/ai/generate/route.ts",
  "src/lib/leo/orchestrator.ts",
  "src/lib/learn/mobile-tutor.ts",
];

describe("Leo conversational paths stay synchronous", () => {
  test("chat/hint/wizard routes do not enqueue BackgroundJob", () => {
    for (const rel of SYNC_PATHS) {
      const source = readFileSync(rel, "utf8");
      assert.doesNotMatch(source, /enqueueBackgroundJob/);
      assert.doesNotMatch(source, /enqueueLessonAiGeneration/);
      assert.doesNotMatch(source, /enqueueExploreGenerationWork/);
    }
  });

  test("migrated lesson generate route no longer calls the provider", () => {
    const source = readFileSync("src/app/api/leo/lessons/generate-session-content/route.ts", "utf8");
    assert.match(source, /enqueueLessonAiGeneration/);
    assert.doesNotMatch(source, /runLessonsLeoCompletion/);
    assert.doesNotMatch(source, /generateSessionContentBlocks/);
  });

  test("Explore feed no longer uses after()", () => {
    const source = readFileSync("src/app/api/learn/mobile/explore/adventures/route.ts", "utf8");
    assert.doesNotMatch(source, /after\(/);
    assert.match(source, /enqueueExploreGenerationWork/);
  });
});
