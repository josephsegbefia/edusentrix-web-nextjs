/**
 * Generate JHS 1 Integrated Science Term 3 scheme PDF aligned to a school's current academic period.
 *
 * Usage:
 *   npx tsx scripts/generate-jhs1-science-term3-scheme-pdf.ts
 *   npx tsx scripts/generate-jhs1-science-term3-scheme-pdf.ts --schoolId 6a1e04271ac0704ad0be556c
 */
import { config as loadEnv } from "dotenv";
import fs from "node:fs";
import path from "node:path";
loadEnv({ path: ".env.local" });
loadEnv();

import connectToDatabase from "../src/db/connectToDatabase";
import { AcademicPeriod } from "../src/models/AcademicPeriod";
import { School } from "../src/models/School";
import { generateJhs1IntegratedScienceTerm3SchemePdf } from "../src/lib/schemes/generate-scheme-of-learning-pdf";

function readArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

async function main() {
  await connectToDatabase();

  const schoolIdArg = readArg("--schoolId");
  const school = schoolIdArg
    ? await School.findById(schoolIdArg).select("name").lean()
    : await School.findOne({ name: /Snow Leopard/i }).select("name").lean();

  if (!school) {
    throw new Error("School not found. Pass --schoolId <id>.");
  }

  const period = await AcademicPeriod.findOne({ schoolId: school._id, isCurrent: true })
    .select("yearLabel term startDate endDate")
    .lean();

  if (!period) {
    throw new Error("No current academic period found for the school.");
  }

  const pdf = await generateJhs1IntegratedScienceTerm3SchemePdf({
    schoolName: school.name || "School",
    academicPeriodLabel: `${period.yearLabel} ${period.term}`,
    period: { startDate: period.startDate, endDate: period.endDate },
  });

  const outDir = path.join(process.cwd(), "public", "downloads");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, pdf.fileName);
  fs.writeFileSync(outPath, pdf.bytes);

  console.log("Generated:", outPath);
  console.log("Term dates:", pdf.periodStartLabel, "to", pdf.periodEndLabel);
  console.log("Week endings:");
  for (const row of pdf.alignedRows) {
    console.log(`  Week ${row.weekNumber}: ${row.weekEndingLabel} — ${row.subStrand}`);
  }
  console.log("\nDownload while dev server is running:");
  console.log(`  http://localhost:3000/downloads/${encodeURIComponent(pdf.fileName)}`);
  console.log("\nOr via admin API (authenticated):");
  console.log("  GET /api/admin/schemes/templates/jhs1-integrated-science-term3/pdf");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
