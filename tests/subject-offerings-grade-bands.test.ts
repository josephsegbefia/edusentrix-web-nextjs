import assert from "node:assert/strict";
import test from "node:test";
import { gradeMatchesTemplateCode } from "@/lib/subject-offerings/grade-bands";

test("matches a curriculum grade from its visible name when its stored code is legacy", () => {
  assert.equal(
    gradeMatchesTemplateCode(
      {
        code: "YR-07",
        name: "Basic 7",
        stage: "Basic",
        order: 7,
      },
      ["B7"]
    ),
    true
  );
});

test("retains support for the normalised stored grade code", () => {
  assert.equal(
    gradeMatchesTemplateCode(
      {
        code: "P4",
        name: "Primary Four",
        stage: "Primary",
        order: 4,
      },
      ["B4"]
    ),
    true
  );
});
