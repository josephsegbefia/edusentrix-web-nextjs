/**
 * Student Academic Profile — Slice 16 (comments section).
 *
 * Run: node --test --import tsx tests/student-academic-profile.comments-section.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildAcademicCommentsSectionModel,
  profileCommentsHasContent,
} from "../src/lib/academics/profile/academic-comments-section-utils";
import type { AcademicProfileCommentsDTO } from "../src/types/academics/student-academic-profile";

const releasedComments: AcademicProfileCommentsDTO = {
  subjectComments: [
    {
      subjectId: "sub1",
      subjectName: "Mathematics",
      teacherId: "t1",
      teacherName: "Ms. Ama",
      comment: "Excellent focus in class.",
    },
  ],
  classTeacherComment: "A respectful and hardworking pupil.",
  headteacherComment: "Keep up the good work.",
  conduct: "Good",
  interest: "Sports",
  attitude: "Positive",
};

describe("profileCommentsHasContent", () => {
  it("detects any populated comment field", () => {
    assert.equal(profileCommentsHasContent(releasedComments), true);
    assert.equal(
      profileCommentsHasContent({
        subjectComments: [],
        classTeacherComment: null,
        headteacherComment: null,
        conduct: null,
        interest: null,
        attitude: null,
      }),
      false
    );
  });
});

describe("buildAcademicCommentsSectionModel", () => {
  it("builds released snapshot comment sections", () => {
    const model = buildAcademicCommentsSectionModel({
      comments: releasedComments,
      isReleased: true,
      dataSource: "report_snapshot",
    });

    assert.equal(model.isOfficialSnapshot, true);
    assert.match(model.sourceLabel, /official report-card/i);
    assert.equal(model.conductFields.length, 3);
    assert.equal(model.textBlocks.length, 2);
    assert.equal(model.subjectComments.length, 1);
    assert.equal(model.showLiveNotice, false);
  });

  it("shows live notice for staff in-progress subject results", () => {
    const model = buildAcademicCommentsSectionModel({
      comments: {
        ...releasedComments,
        conduct: null,
        interest: null,
        attitude: null,
      },
      isReleased: false,
      dataSource: "subject_results",
    });

    assert.equal(model.showLiveNotice, true);
    assert.match(model.sourceLabel, /live subject/i);
  });

  it("includes internal notes only when permitted", () => {
    const withNotes = buildAcademicCommentsSectionModel({
      comments: { ...releasedComments, internalNotes: "Awaiting head review." },
      isReleased: false,
      dataSource: "subject_results",
      canViewInternalNotes: true,
    });
    const without = buildAcademicCommentsSectionModel({
      comments: { ...releasedComments, internalNotes: "Awaiting head review." },
      isReleased: false,
      dataSource: "subject_results",
      canViewInternalNotes: false,
    });

    assert.ok(withNotes.textBlocks.some((block) => block.kind === "internal"));
    assert.equal(
      without.textBlocks.some((block) => block.kind === "internal"),
      false
    );
  });
});
