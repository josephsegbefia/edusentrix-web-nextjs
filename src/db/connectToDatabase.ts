// src/db/connectToDatabase.ts
import mongoose from "mongoose";

const globalWithMongo = globalThis as typeof globalThis & {
	_mongoosePromise?: Promise<typeof mongoose>;
	_mongooseKey?: string;
};

function getDatabaseNameFromUri(uri: string | undefined) {
	if (!uri) return undefined;
	try {
		const parsed = new URL(uri);
		const dbName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
		return dbName || undefined;
	} catch {
		return undefined;
	}
}

function resolveMongoDatabaseName(uri: string | undefined, databaseName?: string) {
	if (databaseName) return databaseName;
	if (process.env.MONGO_DB_NAME) return process.env.MONGO_DB_NAME;
	if (process.env.APP_RUNTIME_MODE === "demo") {
		return (
			process.env.DEMO_MONGO_DB_NAME ||
			process.env.DEMO_DATA_MONGO_DB_NAME ||
			getDatabaseNameFromUri(uri)
		);
	}
	return getDatabaseNameFromUri(uri);
}

export async function connectToDatabase(uri?: string, databaseName?: string) {
	const mongoUri = uri ?? process.env.MONGODB_URI;
	const mongoDatabaseName = resolveMongoDatabaseName(mongoUri, databaseName);

	if (!mongoUri) {
		throw new Error(
			"MONGODB_URI is required. Define it in .env.local or the deployment environment.",
		);
	}

	if (!mongoDatabaseName) {
		throw new Error(
			"MONGO_DB_NAME is required, or MONGODB_URI must include a database name. Expected edusentrix-dev, edusentrix-staging, edusentrix-live, or a configured demo database.",
		);
	}

	const cacheKey = `${mongoUri}::${mongoDatabaseName}`;

	if (
		mongoose.connection.readyState === 1 &&
		globalWithMongo._mongooseKey === cacheKey
	) {
		return mongoose;
	}

	if (
		globalWithMongo._mongoosePromise &&
		globalWithMongo._mongooseKey === cacheKey
	) {
		return globalWithMongo._mongoosePromise;
	}

	if (mongoose.connection.readyState !== 0) {
		try {
			await mongoose.disconnect();
		} catch {
			// Start a new connection below.
		}

		globalWithMongo._mongoosePromise = undefined;
		globalWithMongo._mongooseKey = undefined;
	}

	globalWithMongo._mongooseKey = cacheKey;
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
			globalWithMongo._mongooseKey = undefined;
			console.error("MongoDB connection error:", error);
			throw error;
		});

	return globalWithMongo._mongoosePromise;
}

export async function disconnectDatabase() {
	if (mongoose.connection.readyState !== 0) {
		await mongoose.disconnect();
		globalWithMongo._mongoosePromise = undefined;
		globalWithMongo._mongooseKey = undefined;
		console.log("Disconnected from MongoDB");
	}
}

export default connectToDatabase;
