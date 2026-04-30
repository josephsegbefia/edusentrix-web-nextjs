import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createLibraryBookSchema,
  issueLibraryLoanSchema,
  listLibraryBooksQuerySchema,
  listLibraryLoansQuerySchema,
  patchLibrarySettingsSchema,
  renewLibraryLoanSchema,
  returnLibraryLoanSchema,
  updateLibraryBookCopySchema,
} from "../src/lib/library/library.validators";

test("createLibraryBookSchema accepts minimal payload", () => {
  const parsed = createLibraryBookSchema.safeParse({ title: "Test Book" });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.title, "Test Book");
    assert.deepEqual(parsed.data.tags, []);
    assert.equal(parsed.data.initialCopies, 0);
  }
});

test("createLibraryBookSchema rejects empty title", () => {
  const parsed = createLibraryBookSchema.safeParse({ title: "  " });
  assert.equal(parsed.success, false);
});

test("listLibraryBooksQuerySchema defaults", () => {
  const parsed = listLibraryBooksQuerySchema.safeParse({});
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.page, 1);
    assert.equal(parsed.data.limit, 20);
    assert.equal(parsed.data.status, "active");
    assert.equal(parsed.data.sortBy, "updatedAt");
    assert.equal(parsed.data.sortOrder, "desc");
  }
});

test("patchLibrarySettingsSchema allows partial update", () => {
  const parsed = patchLibrarySettingsSchema.safeParse({ maxRenewals: 2 });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.maxRenewals, 2);
    assert.equal(parsed.data.allowRenewals, undefined);
  }
});

test("updateLibraryBookCopySchema allows status only", () => {
  const parsed = updateLibraryBookCopySchema.safeParse({ status: "maintenance" });
  assert.equal(parsed.success, true);
});

test("issueLibraryLoanSchema parses dueAt", () => {
  const parsed = issueLibraryLoanSchema.safeParse({
    bookId: "65ee1c46f3e2b9b4f111101",
    bookCopyId: "65ee1c46f3e2b9b4f111102",
    borrowerType: "student",
    borrowerId: "65ee1c46f3e2b9b4f111103",
    dueAt: "2030-01-15T00:00:00.000Z",
  });
  assert.equal(parsed.success, true);
});

test("listLibraryLoansQuerySchema defaults", () => {
  const parsed = listLibraryLoansQuerySchema.safeParse({});
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.bucket, "open");
    assert.equal(parsed.data.sortBy, "issuedAt");
  }
});

test("returnLibraryLoanSchema accepts optional fine", () => {
  const parsed = returnLibraryLoanSchema.safeParse({
    returnCondition: "damaged",
    fineAmount: 2,
  });
  assert.equal(parsed.success, true);
});

test("renewLibraryLoanSchema requires newDueAt", () => {
  const parsed = renewLibraryLoanSchema.safeParse({
    newDueAt: "2030-02-01T00:00:00.000Z",
  });
  assert.equal(parsed.success, true);
});
