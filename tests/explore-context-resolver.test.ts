import test from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";

import {
  buildExploreLessonBrief,
  parseExploreLessonId,
  parseExploreSubjectOfferingId,
} from "../src/lib/learn/explore/explore-lesson-context";

test("parseExploreLessonId accepts session- prefix and raw ObjectId", () => {
  const id = new Types.ObjectId();
  assert.equal(parseExploreLessonId(`session-${String(id)}`)?.toString(), String(id));
  assert.equal(parseExploreLessonId(String(id))?.toString(), String(id));
  assert.equal(parseExploreLessonId("not-a-lesson"), null);
});

test("parseExploreSubjectOfferingId rejects invalid ids", () => {
  const id = new Types.ObjectId();
  assert.equal(parseExploreSubjectOfferingId(String(id))?.toString(), String(id));
  assert.equal(parseExploreSubjectOfferingId("bad"), null);
});

test("buildExploreLessonBrief uses class blocks and plan notes only", () => {
  const brief = buildExploreLessonBrief({
    title: "Photosynthesis",
    planNotes: "<p>Focus on <strong>chlorophyll</strong>.</p>",
    contentBlocks: [
      {
        type: "explanation",
        title: "Main idea",
        bodyHtml: "<p>Plants make food using sunlight.</p>",
      },
    ],
  });

  assert.match(brief.classroomBrief, /Main idea:/);
  assert.match(brief.classroomBrief, /Plants make food/);
  assert.match(brief.planNotes, /chlorophyll/);
  assert.equal(brief.topicKeywords, "Photosynthesis");
});

test("buildExploreLessonBrief falls back when blocks are empty", () => {
  const brief = buildExploreLessonBrief({ title: "Fractions" });
  assert.equal(brief.classroomBrief, "Class covered: Fractions.");
  assert.equal(brief.planNotes, "");
});
