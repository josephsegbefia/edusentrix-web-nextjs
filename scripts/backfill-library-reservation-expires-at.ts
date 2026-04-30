/**
 * Backfill `expiresAt` on active holds that are missing it (pending vs ready).
 *
 * Usage:
 *   npx tsx scripts/backfill-library-reservation-expires-at.ts
 *   npx tsx scripts/backfill-library-reservation-expires-at.ts --dryRun
 *
 * Env: MONGODB_URI (via .env.local or .env)
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import mongoose from "mongoose";
import { connectToDatabase } from "../src/db/connectToDatabase";
import { LibraryReservation } from "../src/models/LibraryReservation";
import {
  reservationExpiresAtForPending,
  reservationExpiresAtForReady,
} from "../src/lib/library/library-reservation.constants";

async function main() {
  const dryRun = process.argv.includes("--dryRun");
  await connectToDatabase();

  const filter = {
    status: { $in: ["pending", "ready"] as const },
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }],
  };

  const cursor = LibraryReservation.find(filter)
    .select("_id status reservedAt readyAt")
    .cursor();

  let scanned = 0;
  let updated = 0;
  for await (const doc of cursor) {
    scanned += 1;
    const id = doc._id as mongoose.Types.ObjectId;
    const status = doc.status as string;
    let expiresAt: Date;
    if (status === "ready") {
      const anchor = doc.readyAt ?? doc.reservedAt;
      expiresAt = reservationExpiresAtForReady(anchor);
    } else {
      expiresAt = reservationExpiresAtForPending(doc.reservedAt);
    }

    if (dryRun) {
      continue;
    }

    const r = await LibraryReservation.updateOne(
      { _id: id, status, $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }] },
      { $set: { expiresAt } }
    );
    if ((r.modifiedCount ?? 0) > 0) updated += 1;
  }

  console.log(
    dryRun
      ? `[dryRun] Scanned ${scanned} reservation(s); would set expiresAt`
      : `Scanned ${scanned}, updated ${updated} reservation(s)`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
