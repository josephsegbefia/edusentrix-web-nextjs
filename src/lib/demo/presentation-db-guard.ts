export const PRESENTATION_DEMO_DB_NAME = "edusentrix-demo";

export function getDatabaseNameFromUri(uri: string | undefined): string {
  if (!uri) return "";
  try {
    const parsed = new URL(uri);
    return decodeURIComponent(parsed.pathname.replace(/^\/+/, "")) || "";
  } catch {
    return "";
  }
}

/**
 * Mirror {@link connectToDatabase} name resolution:
 * `MONGO_DB_NAME`, then demo-specific names, then the URI path.
 */
export function resolvePresentationDatabaseName(
  env: NodeJS.ProcessEnv = process.env
): string {
  if (env.MONGO_DB_NAME?.trim()) return env.MONGO_DB_NAME.trim();
  const demoName =
    env.DEMO_MONGO_DB_NAME?.trim() || env.DEMO_DATA_MONGO_DB_NAME?.trim() || "";
  if (env.APP_RUNTIME_MODE === "demo") {
    return demoName || getDatabaseNameFromUri(env.MONGODB_URI);
  }
  return demoName || getDatabaseNameFromUri(env.MONGODB_URI);
}

export function assertPresentationDemoDatabase(databaseName: string): void {
  const name = (databaseName || "").trim();
  if (
    !name ||
    name.toLowerCase().includes("prod") ||
    name !== PRESENTATION_DEMO_DB_NAME
  ) {
    throw new Error(
      `REFUSED: Presentation demo seeding can only run against ${PRESENTATION_DEMO_DB_NAME}.\nCurrent database: ${name || "(empty)"}`
    );
  }
}
