import { MongoClient, type Db } from "mongodb";

const globalWithDemoMongo = globalThis as typeof globalThis & {
  _demoMongoPromise?: Promise<MongoClient>;
  _demoMongoKey?: string;
};

export async function connectToDemoDataDatabase(): Promise<Db | null> {
  const uri =
    process.env.DEMO_DATA_MONGODB_URI || process.env.DEMO_MONGODB_URI || "";
  if (!uri) return null;

  const dbName =
    process.env.DEMO_DATA_MONGO_DB_NAME ||
    process.env.DEMO_MONGO_DB_NAME ||
    undefined;
  const cacheKey = `${uri}::${dbName || ""}`;

  if (
    globalWithDemoMongo._demoMongoPromise &&
    globalWithDemoMongo._demoMongoKey === cacheKey
  ) {
    const client = await globalWithDemoMongo._demoMongoPromise;
    return dbName ? client.db(dbName) : client.db();
  }

  globalWithDemoMongo._demoMongoKey = cacheKey;
  globalWithDemoMongo._demoMongoPromise = MongoClient.connect(uri, {
    serverSelectionTimeoutMS: 8000,
  });

  const client = await globalWithDemoMongo._demoMongoPromise;
  return dbName ? client.db(dbName) : client.db();
}
