// src/db/connectToDatabase.ts
import mongoose from "mongoose";

// Cache the promise on the global object so it survives across hot-reloads
// (dev) AND isn't lost when Vercel freezes/thaws a serverless function while
// the module-level scope is re-initialised on a cold start.
const globalWithMongo = globalThis as typeof globalThis & {
  _mongoosePromise?: Promise<typeof mongoose>;
};

export async function connectToDatabase(uri?: string) {
  const MONGODB_URI = uri ?? process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error(
      "Please define MONGODB_URI in .env.local (or pass --mongo to the seeding script)"
    );
  }

  if (mongoose.connection.readyState === 1) return mongoose;

  // If the connection is stuck in a transitional state (connecting = 2,
  // disconnecting = 3) from a frozen/thawed serverless invocation, tear
  // it down so we can start fresh.
  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.disconnect();
    } catch {
      // ignore — we'll reconnect below
    }
    globalWithMongo._mongoosePromise = undefined;
  }

  if (globalWithMongo._mongoosePromise) {
    return globalWithMongo._mongoosePromise;
  }

  globalWithMongo._mongoosePromise = mongoose
    .connect(MONGODB_URI, {
      autoIndex: true,
      dbName: process.env.MONGO_DB_NAME || undefined,
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 30000,
    })
    .then((m) => {
      console.log(
        `Connected to MongoDB (${process.env.NODE_ENV || "development"})`
      );
      return m;
    })
    .catch((err) => {
      globalWithMongo._mongoosePromise = undefined;
      console.error("Mongo connection error:", err);
      throw err;
    });

  return globalWithMongo._mongoosePromise;
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

export default connectToDatabase;
