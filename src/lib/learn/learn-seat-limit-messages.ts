export type LearnSeatEntitlement = {
  current: number;
  limit: number | null;
  planBase: number | null;
  addonSeats: number;
};

export function formatLearnSeatDeniedMessage(entitlement: LearnSeatEntitlement): string {
  const { current, limit, addonSeats } = entitlement;

  if (limit === null) {
    return "Learn seat limit could not be determined.";
  }

  if (limit <= 0) {
    return [
      "EduSentrix Learn seats are not included in your current plan.",
      "To add seats, a platform administrator can purchase a Learn Seats add-on",
      "(Platform → Schools → your school → Subscription → Usage & Add-ons),",
      "or grant a learnSeats limit override on the school subscription.",
    ].join(" ");
  }

  if (current <= 0) {
    return `Your school has ${limit} Learn seat${limit === 1 ? "" : "s"} available but cannot create an account right now. Please try again or contact support.`;
  }

  const addonNote =
    addonSeats > 0 ? ` (${addonSeats} from purchased add-ons)` : "";

  return [
    `You have used all ${limit} Learn seat${limit === 1 ? "" : "s"}${addonNote}.`,
    `${current} student${current === 1 ? "" : "s"} already have Learn accounts.`,
    "Purchase additional Learn seats or disable unused accounts to free capacity.",
  ].join(" ");
}
