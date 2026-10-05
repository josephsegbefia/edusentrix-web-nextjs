import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  getInvitationAcceptUrl,
  requireInvitationAcceptUrl,
} from "../../src/lib/utils/getAppUrl";

describe("invitation acceptance URLs", () => {
  test("requireInvitationAcceptUrl fails closed when Clerk URL is missing", () => {
    assert.throws(
      () => requireInvitationAcceptUrl({ url: null, emailAddress: "a@example.com" }, "a@example.com"),
      /missing an acceptance URL/
    );
    assert.throws(
      () => requireInvitationAcceptUrl(null, "a@example.com"),
      /missing an acceptance URL/
    );
  });

  test("requireInvitationAcceptUrl returns the Clerk ticket URL", () => {
    const url = requireInvitationAcceptUrl(
      {
        url: "https://clerk.example/invite?__clerk_ticket=abc",
        emailAddress: "a@example.com",
      },
      "a@example.com"
    );
    assert.match(url, /__clerk_ticket=abc/);
    assert.match(url, /invited_email=a%40example.com/);
  });

  test("getInvitationAcceptUrl still has a generic fallback for non-email use", () => {
    const url = getInvitationAcceptUrl(null, "https://app.example/sign-up", "a@example.com");
    assert.match(url, /sign-up/);
    assert.doesNotMatch(url, /__clerk_ticket/);
  });
});
