import test from "node:test";
import assert from "node:assert/strict";

import { buildExploreTemplateFallback } from "../src/lib/learn/explore/explore-template-fallback";
import {
  collectExploreContentText,
  reviewExploreContentSafety,
} from "../src/lib/learn/explore/explore-safety.service";

test("collectExploreContentText includes deep dive and misconceptions", () => {
  const content = buildExploreTemplateFallback({
    studentId: "s1",
    schoolId: "school",
    classGroupId: "class",
    gradeId: null,
    gradeLevel: "Primary 6",
    gradeName: "Primary 6",
    subjectOfferingId: "507f1f77bcf86cd799439011",
    subjectName: "Science",
    lessonId: "507f1f77bcf86cd799439012",
    lessonTitle: "Food Chains",
    lessonBrief: {
      classroomBrief: "Class covered: Food Chains.",
      planNotes: "",
      topicKeywords: "Food Chains",
    },
    sourceContext: {
      schoolId: "school",
      classGroupId: "class",
      subjectId: "507f1f77bcf86cd799439011",
      lessonId: "507f1f77bcf86cd799439012",
      lessonTitle: "Food Chains",
      gradeLevel: "Primary 6",
    },
    generationKey: "key",
    relatedLessonTitles: [],
    flashcardHints: [],
  });

  const text = collectExploreContentText(content);
  assert.match(text, /Food Chains/);
  assert.match(text, /misconception/i);
});

test("reviewExploreContentSafety blocks external links", () => {
  const base = buildExploreTemplateFallback({
    studentId: "s1",
    schoolId: "school",
    classGroupId: "class",
    gradeId: null,
    gradeLevel: "JHS 1",
    gradeName: "JHS 1",
    subjectOfferingId: "507f1f77bcf86cd799439011",
    subjectName: "Science",
    lessonId: "507f1f77bcf86cd799439012",
    lessonTitle: "Cells",
    lessonBrief: {
      classroomBrief: "Class covered: Cells and organelles.",
      planNotes: "",
      topicKeywords: "Cells",
    },
    sourceContext: {
      schoolId: "school",
      classGroupId: "class",
      subjectId: "507f1f77bcf86cd799439011",
      lessonId: "507f1f77bcf86cd799439012",
      lessonTitle: "Cells",
      gradeLevel: "JHS 1",
    },
    generationKey: "key",
    relatedLessonTitles: [],
    flashcardHints: [],
  });

  const review = reviewExploreContentSafety({
    content: {
      ...base,
      intro: "Visit https://unsafe.example.com for answers.",
    },
    lessonBrief: {
      classroomBrief: "Class covered: Cells and organelles.",
      planNotes: "",
      topicKeywords: "Cells",
    },
    gradeName: "JHS 1",
  });

  assert.equal(review.outcome, "blocked");
  assert.ok(review.checks.some((c) => c.name === "external_links" && !c.passed));
});

test("reviewExploreContentSafety passes template fallback content", () => {
  const content = buildExploreTemplateFallback({
    studentId: "s1",
    schoolId: "school",
    classGroupId: "class",
    gradeId: null,
    gradeLevel: "Primary 5",
    gradeName: "Primary 5",
    subjectOfferingId: "507f1f77bcf86cd799439011",
    subjectName: "Mathematics",
    lessonId: "507f1f77bcf86cd799439012",
    lessonTitle: "Fractions",
    lessonBrief: {
      classroomBrief: "Class covered: Fractions basics.",
      planNotes: "",
      topicKeywords: "Fractions",
    },
    sourceContext: {
      schoolId: "school",
      classGroupId: "class",
      subjectId: "507f1f77bcf86cd799439011",
      lessonId: "507f1f77bcf86cd799439012",
      lessonTitle: "Fractions",
      gradeLevel: "Primary 5",
    },
    generationKey: "key",
    relatedLessonTitles: [],
    flashcardHints: [],
  });

  const review = reviewExploreContentSafety({
    content,
    lessonBrief: {
      classroomBrief: "Class covered: Fractions basics.",
      planNotes: "",
      topicKeywords: "Fractions",
    },
    gradeName: "Primary 5",
  });

  assert.ok(
    review.outcome === "passed" || review.outcome === "teacher_review_required"
  );
});
