import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatLearnSeatDeniedMessage } from "../src/lib/learn/learn-seat-limit-messages";

describe("learn-seat-limits", () => {
  it("explains when no learn seats are included", () => {
    const message = formatLearnSeatDeniedMessage({
      current: 0,
      limit: 0,
      planBase: 0,
      addonSeats: 0,
    });

    assert.match(message, /not included in your current plan/i);
    assert.match(message, /Usage & Add-ons/i);
  });

  it("explains when all purchased seats are in use", () => {
    const message = formatLearnSeatDeniedMessage({
      current: 20,
      limit: 20,
      planBase: 0,
      addonSeats: 20,
    });

    assert.match(message, /used all 20 Learn seats/i);
    assert.match(message, /20 students already have Learn accounts/i);
    assert.match(message, /purchased add-ons/i);
  });
});
