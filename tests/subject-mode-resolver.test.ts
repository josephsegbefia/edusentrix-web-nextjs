import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectGhanaianLanguageCode,
  resolveLessonSubjectMode,
} from "../src/lib/lessons/subject-mode-resolver";

describe("subject-mode-resolver", () => {
  it("detects Ghanaian language subjects", () => {
    assert.equal(detectGhanaianLanguageCode("asante twi"), "twi-asante");
    assert.equal(detectGhanaianLanguageCode("ewe language"), "ewe");
  });

  it("detects mathematics mode", () => {
    const result = resolveLessonSubjectMode({ subjectName: "Core Mathematics" });
    assert.equal(result.subjectMode, "mathematics");
    assert.equal(result.confidence, "high");
  });

  it("defaults to general when uncertain", () => {
    const result = resolveLessonSubjectMode({ subjectName: "English Language" });
    assert.equal(result.subjectMode, "general");
  });
});
