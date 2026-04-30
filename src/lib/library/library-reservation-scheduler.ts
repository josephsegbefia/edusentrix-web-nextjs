import mongoose from "mongoose";
import { LibraryReservation } from "@/models/LibraryReservation";
import {
  expireStaleLibraryReservationsForSchool,
  staleLibraryReservationMatch,
} from "@/lib/library/library-reservation.service";

export function isLibraryCronAuthorized(req: {
  headers: { get: (name: string) => string | null };
}): boolean {
  const secret = process.env.LIBRARY_CRON_SECRET || process.env.CRON_SECRET || "";
  if (!secret) return false;
  const bearer = req.headers.get("authorization") || "";
  const xSecret = req.headers.get("x-cron-secret") || "";
  return bearer === `Bearer ${secret}` || xSecret === secret;
}

/**
 * Expire stale holds for every school that has at least one matching reservation.
 * Safe to run on a schedule (daily). Idempotent per reservation.
 */
export async function expireStaleLibraryReservationsGlobally(now = new Date()): Promise<{
  schoolIds: string[];
  promotedReservationCount: number;
}> {
  const schoolIdList = await LibraryReservation.distinct("schoolId", staleLibraryReservationMatch(now));
  let promotedReservationCount = 0;
  for (const sid of schoolIdList) {
    const { promotedReservationIds } = await expireStaleLibraryReservationsForSchool(
      sid as mongoose.Types.ObjectId
    );
    promotedReservationCount += promotedReservationIds.length;
  }
  return {
    schoolIds: schoolIdList.map(String),
    promotedReservationCount,
  };
}
