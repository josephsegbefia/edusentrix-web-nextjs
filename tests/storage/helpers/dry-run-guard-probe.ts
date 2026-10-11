/**
 * Spawned by student-avatar-migration-script.test.ts. Installs the dry-run
 * write guard, then deliberately attempts writes (with autoCreate and
 * autoIndex left on) and prints which ones were blocked as JSON.
 */
import mongoose, { Schema } from "mongoose";
import { installDryRunWriteGuard } from "../../../scripts/storage/normalize-student-avatar-metadata";

async function attempt(name: string, run: () => Promise<unknown>, results: Record<string, string>) {
  try {
    await run();
    results[name] = "written";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results[name] = message.startsWith("Dry run attempted a write") ? "blocked" : `error: ${message}`;
  }
}

async function main() {
  installDryRunWriteGuard();
  const results: Record<string, string> = {};
  await mongoose.connect(process.env.MONGODB_URI!, { dbName: process.env.MONGO_DB_NAME });
  const Probe = mongoose.model("Probe", new Schema({ name: { type: String, index: true } }));
  const collection = mongoose.connection.db!.collection("probes");

  await attempt("model.init", () => Probe.init(), results);
  await attempt("model.create", () => Probe.create({ name: "x" }), results);
  await attempt("model.updateMany", () => Probe.updateMany({}, { $set: { name: "y" } }), results);
  await attempt("model.syncIndexes", () => Probe.syncIndexes(), results);
  await attempt("collection.insertOne", () => collection.insertOne({ name: "x" }), results);
  await attempt("collection.createIndex", () => collection.createIndex({ name: 1 }), results);
  await attempt("collection.bulkWrite", () => collection.bulkWrite([{ insertOne: { document: {} } }]), results);
  await attempt(
    "collection.aggregate$out",
    () => collection.aggregate([{ $match: {} }, { $out: "copied" }]).toArray(),
    results
  );
  await attempt("db.createCollection", () => mongoose.connection.db!.createCollection("made"), results);
  await attempt("db.command(create)", () => mongoose.connection.db!.command({ create: "made" }), results);
  await attempt("db.dropDatabase", () => mongoose.connection.db!.dropDatabase(), results);
  await attempt("read.find", () => collection.find({}).toArray(), results);

  const collections = await mongoose.connection.db!.listCollections().toArray();
  results.collectionsAfter = String(collections.length);
  console.log(JSON.stringify(results));
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
