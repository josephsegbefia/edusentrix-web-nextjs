// src/db/connectToDatabase.ts
import mongoose from "mongoose";

const globalWithMongo = globalThis as typeof globalThis & {
	_mongoosePromise?: Promise<typeof mongoose>;
};

export async function connectToDatabase(uri?: string, databaseName?: string) {
	const mongoUri = uri ?? process.env.MONGODB_URI;
	const mongoDatabaseName = databaseName ?? process.env.MONGO_DB_NAME;

	if (!mongoUri) {
		throw new Error(
			"MONGODB_URI is required. Define it in .env.local or the deployment environment.",
		);
	}

	if (!mongoDatabaseName) {
		throw new Error(
			"MONGO_DB_NAME is required. Expected edusentrix-dev, edusentrix-staging, or edusentrix-live.",
		);
	}

	if (mongoose.connection.readyState === 1) {
		return mongoose;
	}

	if (globalWithMongo._mongoosePromise) {
		return globalWithMongo._mongoosePromise;
	}

	if (mongoose.connection.readyState !== 0) {
		try {
			await mongoose.disconnect();
		} catch {
			// Start a new connection below.
		}

		globalWithMongo._mongoosePromise = undefined;
	}

	globalWithMongo._mongoosePromise = mongoose
		.connect(mongoUri, {
			dbName: mongoDatabaseName,
			autoIndex: process.env.NODE_ENV !== "production",
			serverSelectionTimeoutMS: 8000,
			socketTimeoutMS: 30000,
		})
		.then((connection) => {
			const host = connection.connection.host || "unknown-host";
			const connectedDatabase = connection.connection.name || mongoDatabaseName;
			const runtimeMode = process.env.APP_RUNTIME_MODE || "development";
			const nodeEnv = process.env.NODE_ENV || "development";

			console.log(
				`Connected to MongoDB host=${host} db=${connectedDatabase} runtime=${runtimeMode} nodeEnv=${nodeEnv}`,
			);

			return connection;
		})
		.catch((error: unknown) => {
			globalWithMongo._mongoosePromise = undefined;
			console.error("MongoDB connection error:", error);
			throw error;
		});

	return globalWithMongo._mongoosePromise;
}

export async function disconnectDatabase() {
	if (mongoose.connection.readyState !== 0) {
		await mongoose.disconnect();
		globalWithMongo._mongoosePromise = undefined;
		console.log("Disconnected from MongoDB");
	}
}

export default connectToDatabase;
