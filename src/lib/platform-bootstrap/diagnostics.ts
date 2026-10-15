import "server-only";

export type PlatformBootstrapFailureEvent =
  | "bootstrap_otp_send_failed"
  | "bootstrap_otp_verify_failed"
  | "bootstrap_create_failed"
  | "bootstrap_clerk_invitation_failed";

type ErrorShape = {
  name?: unknown;
  code?: unknown;
};

function safeDiagnosticValue(value: unknown, fallback: string | null) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "string" &&
    value.length <= 64 &&
    /^[A-Za-z0-9_.:-]+$/.test(value)
  ) {
    return value;
  }
  return fallback;
}

export function buildPlatformBootstrapFailureMetadata(input: {
  route: string;
  stage: string;
  error: unknown;
}) {
  const candidate = input.error && typeof input.error === "object"
    ? input.error as ErrorShape
    : {};
  return {
    route: input.route,
    runtimeMode: process.env.APP_RUNTIME_MODE || process.env.NODE_ENV || "unknown",
    databaseName: process.env.MONGO_DB_NAME || "not_configured",
    stage: input.stage,
    errorType: safeDiagnosticValue(candidate.name, "UnknownError"),
    errorCode: safeDiagnosticValue(candidate.code, null),
  };
}

export function logPlatformBootstrapFailure(input: {
  event: PlatformBootstrapFailureEvent;
  route: string;
  stage: string;
  error: unknown;
}) {
  console.error(
    input.event,
    buildPlatformBootstrapFailureMetadata(input)
  );
}
