import { Types } from "mongoose";

/**
 * Strip `undefined` from plain objects (recursively) so Mongoose does not try to
 * cast `undefined` into nested subdocuments (e.g. `billing.paymentSetup.pendingPlatformPayout`).
 */
export function omitUndefinedDeep<T>(input: T): T {
  if (input === undefined || input === null) return input;
  if (typeof input !== "object") return input;
  if (input instanceof Date) return input;
  if (input instanceof Types.ObjectId) return input;
  if (Array.isArray(input)) {
    return input.map((item) => omitUndefinedDeep(item)) as T;
  }

  const proto = Object.getPrototypeOf(input);
  if (proto !== Object.prototype && proto !== null) {
    return input;
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (v === undefined) continue;
    const nested = omitUndefinedDeep(v);
    if (nested === undefined) continue;
    if (
      typeof nested === "object" &&
      nested !== null &&
      !Array.isArray(nested) &&
      !(nested instanceof Date) &&
      !(nested instanceof Types.ObjectId) &&
      Object.getPrototypeOf(nested) === Object.prototype &&
      Object.keys(nested as object).length === 0
    ) {
      continue;
    }
    out[k] = nested;
  }
  return out as T;
}
