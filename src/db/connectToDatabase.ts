// src/db/connectToDatabase.ts
import mongoose from "mongoose";

let connPromise: Promise<typeof mongoose> | null = null;

export async function connectToDatabase(uri?: string) {
  const MONGODB_URI = uri ?? process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error(
      "Please define MONGODB_URI in .env.local (or pass --mongo to the seeding script)"
    );
  }

  // Already connected
  if (mongoose.connection.readyState === 1) return mongoose;

  // Reuse ongoing connection attempt
  if (connPromise) return connPromise;

  connPromise = mongoose
    .connect(MONGODB_URI, {
      autoIndex: true,
      dbName: process.env.MONGO_DB_NAME || undefined,
    })
    .then((m) => {
      console.log(
        `Connected to MongoDB (${process.env.NODE_ENV || "development"})`
      );
      return m;
    })
    .catch((err) => {
      connPromise = null;
      console.error("Mongo connection error:", err);
      throw err;
    });

  return connPromise;
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

export default connectToDatabase;
