/**
 * Backfill `leaveRequest.submittedBy` on pending teacher leave rows created before the field existed,
 * using only the matching `leave.submitted` audit record. Unmatched rows are left alone; they are
 * attendance, not leave requests, and stay out of the approval queue.
 *
 * Usage:
 *   npx tsx scripts/backfill-leave-request-originators.ts                      # dry run (default)
 *   npx tsx scripts/backfill-leave-request-originators.ts --school <schoolId>  # dry run, one school
 *   npx tsx scripts/backfill-leave-request-originators.ts --apply --confirm-db <dbName> --manifest <new file>
 *   npx tsx scripts/backfill-leave-request-originators.ts --rollback <manifest file> --confirm-db <dbName>
 *
 * Output is counts only. The manifest holds record and user ids, so keep it out of the repository.
 * Env: MONGODB_URI (via .env.local or .env)
 */
import { config } from "dotenv";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import mongoose from "mongoose";
import { connectToDatabase } from "../src/db/connectToDatabase";
import {
  applyLeaveRequestBackfill,
  planLeaveRequestBackfill,
  rollbackLeaveRequestBackfill,
  type BackfillMatch,
} from "../src/lib/teachers/leave-request-backfill";

function arg(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function requireConfirmedDatabase() {
  const expected = arg("--confirm-db");
  const actual = mongoose.connection.name;
  if (!expected || expected !== actual) {
    throw new Error("Writes need --confirm-db with the name of the connected database.");
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const rollbackPath = arg("--rollback");
  const school = arg("--school");
  if (apply && rollbackPath) {
    throw new Error("Use either --apply or --rollback, not both.");
  }
  if (school && !/^[0-9a-fA-F]{24}$/.test(school)) {
    throw new Error("--school must be a 24-character id.");
  }

  await connectToDatabase();

  if (rollbackPath) {
    requireConfirmedDatabase();
    const manifest = JSON.parse(readFileSync(resolve(rollbackPath), "utf8")) as BackfillMatch[];
    const { restored, notRestored } = await rollbackLeaveRequestBackfill(manifest);
    console.log(`Rollback: ${restored} row(s) restored, ${notRestored} left (decided since, or already changed).`);
    return;
  }

  const plan = await planLeaveRequestBackfill(
    school ? { schoolId: new mongoose.Types.ObjectId(school) } : {}
  );
  const summary =
    `scanned ${plan.scanned}, matched ${plan.matched.length}, ` +
    `no audit record ${plan.skipped.no_audit_record}, ambiguous ${plan.skipped.ambiguous}, ` +
    `invalid submitter ${plan.skipped.invalid_submitter}`;

  if (!apply) {
    console.log(`[dry run] ${summary}. Unmatched rows would leave the approval queue.`);
    return;
  }

  requireConfirmedDatabase();
  const manifestPath = arg("--manifest");
  if (!manifestPath) {
    throw new Error("--apply needs --manifest <new file> for rollback.");
  }
  const target = resolve(manifestPath);
  if (existsSync(target)) {
    throw new Error("The manifest file already exists. Choose a new path.");
  }
  writeFileSync(target, "[]\n", { flag: "wx" });
  const written = await applyLeaveRequestBackfill(plan.matched);
  writeFileSync(target, `${JSON.stringify(written, null, 2)}\n`);
  console.log(`Applied: ${summary}; wrote ${written.length} row(s). Manifest saved.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : "Backfill failed");
    process.exit(1);
  });
