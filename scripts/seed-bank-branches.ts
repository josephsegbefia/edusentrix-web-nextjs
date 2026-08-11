// scripts/seed-bank-branches.ts
import { config as loadEnv } from "dotenv";
// 1) Prefer .env.local, then fallback to .env
loadEnv({ path: ".env.local" });
loadEnv();

import fs from "fs";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { parse } from "csv-parse";
import mongoose from "mongoose";
import connectToDatabase, {
  disconnectDatabase,
} from "../src/db/connectToDatabase";
import { BankBranch } from "../src/models/BankBranch";

type Row = {
  SORTCODE: string;
  BANKNAME: string;
  BRANCHNAME: string;
};

const argv = yargs(hideBin(process.argv))
  .option("file", {
    type: "string",
    demandOption: true,
    describe:
      "Path to CSV file (UTF-8) with headers: SORTCODE,BANKNAME,BRANCHNAME",
  })
  .option("mongo", {
    type: "string",
    describe: "MongoDB connection string (overrides MONGODB_URI)",
  })
  .option("drop", {
    type: "boolean",
    default: false,
    describe: "Drop the BankBranch collection before seeding",
  })
  .option("dryRun", {
    type: "boolean",
    default: false,
    describe: "Parse and validate only; do not write to DB",
  })
  .strict()
  .help()
  .parseSync();

function normalize(s: string) {
  return s
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/[‘’'"]/g, "")
    .replace(/\s*-\s*/g, " - ")
    .trim();
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/(^-|-$)+/g, "");
}

async function createIndexIfNeeded(
  keys: Record<string, 1 | -1 | "text">,
  options?: Record<string, unknown>
) {
  try {
    await BankBranch.collection.createIndex(keys, options);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("Index already exists") ||
        error.message.includes("already exists with a different name"))
    ) {
      return;
    }
    throw error;
  }
}

(async () => {
  const filePath = path.resolve(argv.file);
  if (!fs.existsSync(filePath)) {
    console.error(`CSV not found at ${filePath}`);
    process.exit(1);
  }

  const cliUri = argv.mongo || undefined;
  await connectToDatabase(cliUri);

  // Try to ensure the collection exists with a reasonable collation.
  // If it already exists, createCollection will throw—ignore.
  try {
    await mongoose.connection.createCollection("bankbranches", {
      collation: { locale: "en", strength: 2 },
    });
  } catch (_) {
    /* ok if exists */
  }

  if (argv.drop) {
    try {
      await mongoose.connection.collection("bankbranches").drop();
      console.log("Dropped existing collection: bankbranches");
      // Re-create with collation after drop for consistent behavior
      await mongoose.connection.createCollection("bankbranches", {
        collation: { locale: "en", strength: 2 },
      });
    } catch {
      console.log("No existing collection to drop (ok).");
    }
  }

  console.log("Reading CSV:", filePath);

  const seen = new Map<
    string,
    { sortCode: string; bankName: string; branchName: string }
  >();

  let rawCount = 0;
  let badRows = 0;
  let duplicateSortCodes = 0;

  const parser = fs
    .createReadStream(filePath, { encoding: "utf8" })
    .pipe(parse({ columns: true, trim: true, skip_empty_lines: true }));

  for await (const rec of parser as AsyncIterable<Row>) {
    rawCount++;

    const sortCode = (rec.SORTCODE || "").replace(/\D/g, "").trim();
    const bankName = normalize(rec.BANKNAME || "");
    const branchName = normalize(rec.BRANCHNAME || "");

    if (!/^\d{6}$/.test(sortCode) || !bankName || !branchName) {
      badRows++;
      continue;
    }

    if (seen.has(sortCode)) {
      duplicateSortCodes++;
      const prev = seen.get(sortCode)!;
      if (branchName.length > prev.branchName.length) {
        seen.set(sortCode, { sortCode, bankName, branchName });
      }
    } else {
      seen.set(sortCode, { sortCode, bankName, branchName });
    }
  }

  const payload = Array.from(seen.values());

  console.log("— Summary —");
  console.log("Raw rows:", rawCount);
  console.log("Unique sort codes:", payload.length);
  console.log("Duplicates (by sortCode):", duplicateSortCodes);
  console.log("Bad rows skipped:", badRows);

  if (argv.dryRun) {
    console.log("Dry run: no DB writes performed.");
    await disconnectDatabase();
    process.exit(0);
  }

  // Bulk upsert
  const ops = payload.map((p) => ({
    updateOne: {
      filter: { sortCode: p.sortCode },
      update: {
        $set: {
          sortCode: p.sortCode,
          bankName: p.bankName,
          branchName: p.branchName,
          bankNameNormalized: normalize(p.bankName),
          branchNameNormalized: normalize(p.branchName),
          bankSlug: slugify(p.bankName),
          isActive: true,
        },
      },
      upsert: true,
    },
  }));

  console.log("Writing to DB (bulk upsert)...");
  const res = await BankBranch.bulkWrite(ops, { ordered: false });

  console.log("— Write Results —");
  console.log("Inserted (upserted):", res.upsertedCount || 0);
  console.log("Modified:", res.modifiedCount || 0);

  // Helpful indexes (idempotent)
  await createIndexIfNeeded({ sortCode: 1 }, { unique: true });
  await createIndexIfNeeded(
    { bankName: "text", branchName: "text" },
    { name: "bank_branch_text", collation: { locale: "simple" } }
  );
  await createIndexIfNeeded({ bankName: 1 });
  await createIndexIfNeeded({ branchName: 1 });
  await createIndexIfNeeded({ bankSlug: 1 });
  await createIndexIfNeeded({ bankNameNormalized: 1 });
  await createIndexIfNeeded({ branchNameNormalized: 1 });

  await disconnectDatabase();
  console.log("✅ Done.");
})().catch(async (err) => {
  console.error(err);
  try {
    await disconnectDatabase();
  } finally {
    process.exit(1);
  }
});
