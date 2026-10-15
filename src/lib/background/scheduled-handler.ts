import "server-only";

import { connectToDatabase } from "@/db/connectToDatabase";

export type ScheduledDatabaseConnector = () => Promise<unknown>;

/**
 * Builds the shared execution boundary for cron handlers that use Mongoose.
 * Keeping the connector injectable makes connection ordering and failure
 * propagation testable without opening a real database connection.
 */
export function createDatabaseBackedScheduleRunner(
  connect: ScheduledDatabaseConnector
) {
  return async function runDatabaseBackedSchedule<T>(
    handler: () => Promise<T>
  ): Promise<T> {
    await connect();
    return handler();
  };
}

export const runDatabaseBackedSchedule =
  createDatabaseBackedScheduleRunner(connectToDatabase);
