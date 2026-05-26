import test from "node:test";
import assert from "node:assert/strict";

import {
  buildExplorePromptPair,
  buildExploreSystemPrompt,
} from "../src/lib/learn/explore/explore-prompts";

test("buildExploreSystemPrompt forbids lesson repetition and requires JSON", () => {
  const prompt = buildExploreSystemPrompt();
  assert.match(prompt, /Do NOT repeat/i);
  assert.match(prompt, /STRICT JSON ONLY/i);
  assert.match(prompt, /misconception/i);
  assert.match(prompt, /Ghanaian\/African/i);
});

test("buildExploreUserPrompt uses approved lesson context only", () => {
  const pair = buildExplorePromptPair({
    mode: "go_deeper",
    context: {
      studentId: "student-1",
      schoolId: "school-1",
      classGroupId: "class-1",
      gradeId: null,
      gradeLevel: "JHS 2",
      gradeName: "JHS 2",
      subjectOfferingId: "sub-1",
      subjectName: "Integrated Science",
      lessonId: "lesson-1",
      lessonTitle: "Photosynthesis",
      lessonBrief: {
        classroomBrief: "Main idea: plants use sunlight.",
        planNotes: "Lab demo with leaves.",
        topicKeywords: "Photosynthesis",
      },
      sourceContext: {
        schoolId: "school-1",
        classGroupId: "class-1",
        subjectId: "sub-1",
        lessonId: "lesson-1",
        lessonTitle: "Photosynthesis",
        gradeLevel: "JHS 2",
      },
      generationKey: "gen-key",
      relatedLessonTitles: ["Plant parts"],
      flashcardHints: [{ front: "chlorophyll", back: "green pigment" }],
    },
  });

  assert.match(pair.systemPrompt, /Do NOT repeat/i);
  assert.match(pair.userPrompt, /ALREADY TAUGHT IN CLASS/);
  assert.match(pair.userPrompt, /Photosynthesis/);
  assert.match(pair.userPrompt, /go_deeper/);
  assert.doesNotMatch(pair.userPrompt, /Student focus request/i);
});
