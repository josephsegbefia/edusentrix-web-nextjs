import test from "node:test";
import assert from "node:assert/strict";

import {
  formatGhanaLocalPhoneInput,
  formatGhanaPhoneInput,
  normalizeGhanaPhoneForStorage,
} from "../src/lib/phone/ghana";

test("formats local Ghana draft input while preserving a leading zero during typing", () => {
  assert.equal(formatGhanaLocalPhoneInput("0"), "0");
  assert.equal(formatGhanaLocalPhoneInput("0241234567"), "024 123 4567");
});

test("normalizes Ghana numbers to the +233 standard", () => {
  assert.equal(formatGhanaPhoneInput("0241234567"), "+233 24 123 4567");
  assert.equal(formatGhanaPhoneInput("+233241234567"), "+233 24 123 4567");
  assert.equal(normalizeGhanaPhoneForStorage("0241234567"), "+233 24 123 4567");
});

test("does not swallow the user's first zero while the number is incomplete", () => {
  assert.equal(formatGhanaPhoneInput("0"), "0");
  assert.equal(normalizeGhanaPhoneForStorage("0"), "0");
});
