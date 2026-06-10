import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canStudentViewNotebookNotes } from "../src/lib/lessons/notebook-notes-visibility";

describe("canStudentViewNotebookNotes", () => {
  it("requires publish flag, content, and taught delivery", () => {
    assert.equal(
      canStudentViewNotebookNotes({
        notebookNotesPublished: true,
        boardNotesHtml: "<p>Notes</p>",
        deliveryStatus: "delivered",
      }),
      true,
    );
    assert.equal(
      canStudentViewNotebookNotes({
        notebookNotesPublished: false,
        boardNotesHtml: "<p>Notes</p>",
        deliveryStatus: "delivered",
      }),
      false,
    );
    assert.equal(
      canStudentViewNotebookNotes({
        notebookNotesPublished: true,
        boardNotesHtml: "<p>Notes</p>",
        deliveryStatus: "scheduled",
      }),
      false,
    );
  });
});
