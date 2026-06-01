import mongoose, { type ClientSession } from "mongoose";

export class MongoTransactionError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "MongoTransactionError";
    this.statusCode = statusCode;
  }
}

/**
 * Runs a MongoDB transaction. Commits on success; aborts and rethrows on failure.
 */
export async function runMongoTransaction<T>(
  handler: (session: ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await handler(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction().catch(() => {});
    throw error;
  } finally {
    await session.endSession();
  }
}
