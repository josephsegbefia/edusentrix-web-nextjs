import { MongoClient, type Db } from "mongodb";

const globalWithDemoMongo = globalThis as typeof globalThis & {
  _demoMongoPromise?: Promise<MongoClient>;
  _demoMongoKey?: string;
};

function getConfiguredDemoDataUri() {
  return process.env.DEMO_DATA_MONGODB_URI || process.env.DEMO_MONGODB_URI || "";
}

function getDatabaseNameFromUri(uri: string) {
  if (!uri) return undefined;
  try {
    const parsed = new URL(uri);
    const dbName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
    return dbName || undefined;
  } catch {
    return undefined;
  }
}

export function getDemoDataDatabaseConfig() {
  const uri = getConfiguredDemoDataUri();
  const explicitDbName =
    process.env.DEMO_DATA_MONGO_DB_NAME ||
    process.env.DEMO_MONGO_DB_NAME ||
    undefined;
  const uriDbName = getDatabaseNameFromUri(uri);

  return {
    hasUri: Boolean(uri),
    databaseName: explicitDbName || uriDbName || undefined,
    databaseNameSource: explicitDbName ? "env" : uriDbName ? "uri" : "driver_default",
  };
}

export async function connectToDemoDataDatabase(): Promise<Db | null> {
  const uri = getConfiguredDemoDataUri();
  if (!uri) return null;

  const dbName = getDemoDataDatabaseConfig().databaseName;
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
