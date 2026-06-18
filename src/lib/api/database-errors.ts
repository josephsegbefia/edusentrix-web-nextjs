export function isDatabaseConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const cause = (error as { cause?: unknown }).cause;
  const causeCode =
    cause && typeof cause === "object" && "code" in cause
      ? String((cause as { code?: unknown }).code)
      : "";

  return (
    error.name === "MongoServerSelectionError" ||
    error.name === "MongoNetworkError" ||
    causeCode === "ENOTFOUND" ||
    causeCode === "ECONNREFUSED" ||
    causeCode === "ETIMEDOUT"
  );
}

export const databaseUnavailableMessage =
  "Database connection is unavailable. Check the MongoDB connection or network and try again.";
