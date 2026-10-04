/**
 * READ-ONLY production storage occupancy scan.
 *
 * Usage:
 *   MONGODB_URI='...' MONGO_DB_NAME=edusentrix-prod \
 *     npx tsx scripts/audit-production-storage-occupancy.ts
 *
 * Refuses any database name other than edusentrix-prod.
 * Does not load .env.local (that file points at edusentrix-dev).
 * find / aggregate / listCollections only. No writes, no indexes.
 */
import mongoose from "mongoose";

const REQUIRED_DB = "edusentrix-prod";

const HOST_RX =
  /utfs\.io|ufs\.sh|uploadthing|res\.cloudinary\.com|cloudinary\.com|\/uploads\/|data:image\//i;

type Provider =
  | "UPLOADTHING"
  | "CLOUDINARY"
  | "LOCAL_UPLOAD"
  | "DATA_URL"
  | "OTHER_LEGACY_STORAGE";

function classify(value: unknown): Provider | null {
  if (typeof value !== "string" || !value) return null;
  const v = value.toLowerCase();
  if (v.includes("utfs.io") || v.includes("ufs.sh") || v.includes("uploadthing")) {
    return "UPLOADTHING";
  }
  if (v.includes("res.cloudinary.com") || v.includes("cloudinary.com")) {
    return "CLOUDINARY";
  }
  if (v.includes("/uploads/") || v.startsWith("/uploads")) return "LOCAL_UPLOAD";
  if (v.startsWith("data:image/")) return "DATA_URL";
  if (HOST_RX.test(value)) return "OTHER_LEGACY_STORAGE";
  return null;
}

function walk(value: unknown, prefix: string, hits: Array<{ field: string; provider: Provider }>) {
  if (typeof value === "string") {
    const provider = classify(value);
    if (provider) hits.push({ field: prefix || "(root)", provider });
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walk(item, prefix, hits);
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "_id") continue;
      walk(v, prefix ? `${prefix}.${k}` : k, hits);
    }
  }
}

const TARGETS: Array<{ collection: string; model: string; fields: string[] }> = [
  { collection: "users", model: "User", fields: ["avatarUrl"] },
  {
    collection: "students",
    model: "Student",
    fields: ["photoUrl", "enrollmentDocuments.fileUrl", "recordDocuments.fileUrl"],
  },
  { collection: "guardians", model: "Guardian", fields: ["photoUrl"] },
  { collection: "schools", model: "School", fields: ["logo"] },
  { collection: "teachers", model: "Teacher", fields: ["qualifications.documentUrl"] },
  { collection: "teacherdocuments", model: "TeacherDocument", fields: ["fileUrl"] },
  { collection: "librarybooks", model: "LibraryBook", fields: ["coverImageUrl"] },
  { collection: "libraryimportjobs", model: "LibraryImportJob", fields: ["fileUrl"] },
  { collection: "schemeimportjobs", model: "SchemeImportJob", fields: ["fileUrl"] },
  { collection: "lessonresources", model: "LessonResource", fields: ["fileUrl", "url"] },
  { collection: "lessonflashcards", model: "LessonFlashcard", fields: ["imageUrl"] },
  { collection: "homeworks", model: "Homework", fields: ["attachments.url"] },
  { collection: "submissions", model: "Submission", fields: ["attachments.url"] },
  { collection: "notices", model: "Notice", fields: ["attachments.url"] },
  { collection: "journalentries", model: "JournalEntry", fields: ["attachments.url"] },
  { collection: "messages", model: "Message", fields: ["attachments.url"] },
  {
    collection: "admissionapplications",
    model: "AdmissionApplication",
    fields: ["applicant.photoUrl", "documents.fileUrl"],
  },
  { collection: "schoolexpenses", model: "SchoolExpense", fields: ["receipts.url"] },
  { collection: "payments", model: "Payment", fields: ["attachments"] },
  {
    collection: "financialtransactions",
    model: "FinancialTransaction",
    fields: ["attachments.url"],
  },
  { collection: "examquestions", model: "ExamQuestion", fields: ["attachments.url"] },
  { collection: "questionbankitems", model: "QuestionBankItem", fields: ["attachments.url"] },
  { collection: "storeproducts", model: "StoreProduct", fields: ["imageUrl"] },
  {
    collection: "academiccalendarevents",
    model: "AcademicCalendarEvent",
    fields: ["coverImageUrl"],
  },
  {
    collection: "communitypolls",
    model: "CommunityPoll",
    fields: ["imageUrl", "coverImageUrl"],
  },
  { collection: "polltemplates", model: "PollTemplate", fields: ["imageUrl"] },
  {
    collection: "fundraisingcampaigns",
    model: "FundraisingCampaign",
    fields: ["coverImageUrl"],
  },
  {
    collection: "fundraisingcampaignupdates",
    model: "FundraisingCampaignUpdate",
    fields: ["attachments"],
  },
  { collection: "proposalbrandings", model: "ProposalBranding", fields: ["logoUrl"] },
  { collection: "studentreportcards", model: "StudentReportCard", fields: ["pdfUrl"] },
  { collection: "teacherresources", model: "TeacherResource", fields: ["url"] },
  { collection: "emailmessages", model: "EmailMessage", fields: ["storageKey", "attachments.storageKey"] },
];

const CATCHALL_PATHS = [
  "avatarUrl",
  "photoUrl",
  "fileUrl",
  "imageUrl",
  "coverImageUrl",
  "logoUrl",
  "pdfUrl",
  "documentUrl",
  "logo",
  "url",
  "storageKey",
  "fileKey",
  "uploadThingKey",
  "attachments",
  "attachments.url",
  "receipts.url",
  "qualifications.documentUrl",
  "enrollmentDocuments.fileUrl",
  "recordDocuments.fileUrl",
  "documents.fileUrl",
  "applicant.photoUrl",
];

function fieldOr(paths: string[]) {
  return { $or: paths.map((p) => ({ [p]: HOST_RX })) };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGO_DB_NAME;
  if (!uri) throw new Error("MONGODB_URI is required and must be passed in the environment");
  if (dbName !== REQUIRED_DB) {
    throw new Error(
      `Refusing to scan: MONGO_DB_NAME must be ${REQUIRED_DB} (got ${JSON.stringify(dbName)}). This script does not load .env.local.`
    );
  }

  mongoose.set("autoIndex", false);
  mongoose.set("autoCreate", false);
  await mongoose.connect(uri, {
    dbName,
    autoIndex: false,
    autoCreate: false,
    readPreference: "secondaryPreferred",
    serverSelectionTimeoutMS: 20000,
  });

  const db = mongoose.connection.db;
  if (!db) throw new Error("No database handle");
  if (db.databaseName !== REQUIRED_DB) {
    throw new Error(`Connected to unexpected database ${db.databaseName}`);
  }

  console.log(`READ-ONLY scan  db=${db.databaseName}  host=${mongoose.connection.host}`);
  console.log("Mode: find + listCollections only. No writes.\n");

  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));
  const matchedDocIds = new Set<string>();
  const providerDocs: Record<Provider, Set<string>> = {
    UPLOADTHING: new Set(),
    CLOUDINARY: new Set(),
    LOCAL_UPLOAD: new Set(),
    DATA_URL: new Set(),
    OTHER_LEGACY_STORAGE: new Set(),
  };
  const rows: Array<{
    model: string;
    collection: string;
    field: string;
    provider: Provider;
    count: number;
    sampleIds: string[];
  }> = [];

  for (const target of TARGETS) {
    if (!existing.has(target.collection)) {
      console.log(`SKIP  ${target.model}  collection "${target.collection}" not present`);
      continue;
    }
    const col = db.collection(target.collection);
    const cursor = col.find(fieldOr(target.fields), {
      projection: Object.fromEntries(target.fields.map((f) => [f.split(".")[0], 1])),
      limit: 5000,
    });
    const byFieldProvider = new Map<string, { ids: string[] }>();
    for await (const doc of cursor) {
      const hits: Array<{ field: string; provider: Provider }> = [];
      walk(doc, "", hits);
      const relevant = hits.filter((h) =>
        target.fields.some((f) => h.field === f || h.field.startsWith(`${f}.`) || f.startsWith(`${h.field}.`) || h.field.endsWith(f.split(".").pop() || ""))
      );
      const use = relevant.length > 0 ? relevant : hits;
      if (use.length === 0) continue;
      const id = String(doc._id);
      matchedDocIds.add(id);
      for (const hit of use) {
        if (!target.fields.some((f) => hit.field === f || hit.field.startsWith(`${f}`) || f.endsWith(hit.field.split(".").pop() || ""))) {
          continue;
        }
        const field = target.fields.find((f) => hit.field === f || hit.field.startsWith(f) || hit.field.endsWith(f.split(".").pop() || "")) || hit.field;
        providerDocs[hit.provider].add(id);
        const key = `${field}|${hit.provider}`;
        const bucket = byFieldProvider.get(key) ?? { ids: [] };
        if (!bucket.ids.includes(id)) bucket.ids.push(id);
        byFieldProvider.set(key, bucket);
      }
    }
    if (byFieldProvider.size === 0) {
      console.log(`OK    ${target.model}  0 matches`);
      continue;
    }
    for (const [key, bucket] of byFieldProvider) {
      const [field, provider] = key.split("|") as [string, Provider];
      rows.push({
        model: target.model,
        collection: target.collection,
        field,
        provider,
        count: bucket.ids.length,
        sampleIds: bucket.ids.slice(0, 5),
      });
    }
  }

  const targeted = new Set(TARGETS.map((t) => t.collection));
  const extraCollections: string[] = [];
  for (const name of [...existing].sort()) {
    if (targeted.has(name)) continue;
    if (name.startsWith("system.")) continue;
    const col = db.collection(name);
    const count = await col.countDocuments(fieldOr(CATCHALL_PATHS));
    if (count === 0) continue;
    extraCollections.push(name);
    const cursor = col.find(fieldOr(CATCHALL_PATHS), { limit: 5000 });
    const byFieldProvider = new Map<string, { ids: string[] }>();
    for await (const doc of cursor) {
      const hits: Array<{ field: string; provider: Provider }> = [];
      walk(doc, "", hits);
      if (hits.length === 0) continue;
      const id = String(doc._id);
      matchedDocIds.add(id);
      for (const hit of hits) {
        providerDocs[hit.provider].add(id);
        const key = `${hit.field}|${hit.provider}`;
        const bucket = byFieldProvider.get(key) ?? { ids: [] };
        if (!bucket.ids.includes(id)) bucket.ids.push(id);
        byFieldProvider.set(key, bucket);
      }
    }
    for (const [key, bucket] of byFieldProvider) {
      const [field, provider] = key.split("|") as [string, Provider];
      rows.push({
        model: `(extra) ${name}`,
        collection: name,
        field,
        provider,
        count: bucket.ids.length,
        sampleIds: bucket.ids.slice(0, 5),
      });
    }
  }

  console.log("\n=== MATCHES (counts only; no URLs) ===\n");
  if (rows.length === 0) {
    console.log("None.");
  } else {
    for (const row of rows.sort((a, b) => a.collection.localeCompare(b.collection) || a.field.localeCompare(b.field))) {
      console.log(
        [
          `collection=${row.collection}`,
          `model=${row.model}`,
          `field=${row.field}`,
          `provider=${row.provider}`,
          `count=${row.count}`,
          `sampleIds=${row.sampleIds.join(",")}`,
        ].join("  ")
      );
    }
  }

  if (extraCollections.length > 0) {
    console.log(`\nExtra collections with matching URL-like fields: ${extraCollections.join(", ")}`);
  }

  console.log("\n=== TOTALS ===");
  console.log(`TOTAL MATCHING DOCUMENTS ${matchedDocIds.size}`);
  console.log(`UPLOADTHING count ${providerDocs.UPLOADTHING.size}`);
  console.log(`CLOUDINARY count ${providerDocs.CLOUDINARY.size}`);
  console.log(`LOCAL_UPLOAD count ${providerDocs.LOCAL_UPLOAD.size}`);
  console.log(`DATA_URL count ${providerDocs.DATA_URL.size}`);
  if (providerDocs.OTHER_LEGACY_STORAGE.size > 0) {
    console.log(`OTHER_LEGACY_STORAGE count ${providerDocs.OTHER_LEGACY_STORAGE.size}`);
  }

  const blocked =
    providerDocs.UPLOADTHING.size +
      providerDocs.CLOUDINARY.size +
      providerDocs.LOCAL_UPLOAD.size +
      providerDocs.DATA_URL.size +
      providerDocs.OTHER_LEGACY_STORAGE.size >
    0;
  console.log(blocked ? "\nCLEAN_CUTOVER_BLOCKED" : "\nCLEAN_CUTOVER_CONFIRMED");
}

main()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });
