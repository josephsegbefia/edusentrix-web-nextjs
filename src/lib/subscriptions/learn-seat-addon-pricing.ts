import type { AddOnType } from "@/models/SubscriptionAddOn";

/** Learn seat add-on priceMinor is stored per seat (parent billing reference), not package total. */
export function isLearnSeatPerSeatPricing(addonType: AddOnType): boolean {
  return addonType === "learn_seats";
}

export function learnSeatReferenceTotalMinor(pricePerSeatMinor: number, quantity: number): number {
  return Math.max(0, pricePerSeatMinor) * Math.max(0, quantity);
}
