/**
 * Sync Mongoose indexes for Library collections (e.g. after changing the text index on LibraryBook).
 *
 * Usage:
 *   npx tsx scripts/sync-library-indexes.ts
 *
 * Env: MONGODB_URI (via .env.local or .env)
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { connectToDatabase } from "../src/db/connectToDatabase";
import { LibraryBook } from "../src/models/LibraryBook";
import { LibraryBookCopy } from "../src/models/LibraryBookCopy";
import { LibraryLoan } from "../src/models/LibraryLoan";
import { LibrarySettings } from "../src/models/LibrarySettings";
import { LibraryImportJob } from "../src/models/LibraryImportJob";
import { LibraryNotice } from "../src/models/LibraryNotice";
import { LibraryReservation } from "../src/models/LibraryReservation";

async function main() {
  await connectToDatabase();
  const [books, copies, loans, settings, imports, notices, reservations] = await Promise.all([
    LibraryBook.syncIndexes(),
    LibraryBookCopy.syncIndexes(),
    LibraryLoan.syncIndexes(),
    LibrarySettings.syncIndexes(),
    LibraryImportJob.syncIndexes(),
    LibraryNotice.syncIndexes(),
    LibraryReservation.syncIndexes(),
  ]);
  console.log("LibraryBook.syncIndexes:", books);
  console.log("LibraryBookCopy.syncIndexes:", copies);
  console.log("LibraryLoan.syncIndexes:", loans);
  console.log("LibrarySettings.syncIndexes:", settings);
  console.log("LibraryImportJob.syncIndexes:", imports);
  console.log("LibraryNotice.syncIndexes:", notices);
  console.log("LibraryReservation.syncIndexes:", reservations);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
