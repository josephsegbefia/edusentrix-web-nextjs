import mongoose from "mongoose";
import {
  trackUsage as trackUsageMetric,
  type TrackUsageInput,
} from "@/lib/billing/entitlements";

export async function trackUsage(input: TrackUsageInput) {
  return trackUsageMetric(input);
}

export function toObjectId(value: string | mongoose.Types.ObjectId) {
  return typeof value === "string"
    ? new mongoose.Types.ObjectId(value)
    : value;
}
