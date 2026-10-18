import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import process from "node:process";

/** @type {Readonly<Record<string, string>>} */
export const SAFE_BUILD_ENVIRONMENT = Object.freeze({
  APP_RUNTIME_MODE: "development",
  APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  MONGODB_URI: "mongodb://127.0.0.1:1/isolated-build-verification",
  MONGO_DB_NAME: "isolated-build-verification",
  NEXT_TELEMETRY_DISABLED: "1",
  // Next reads .env.local during production builds. This tells its env loader
  // that the process has already been sanitized, so those values are not merged.
  __NEXT_PROCESSED_ENV: "1",
});

/** @typedef {Readonly<Record<string, string | undefined>>} BuildEnvironmentSource */

const PASSTHROUGH_ENV_KEYS = [
  "CI",
  "FORCE_COLOR",
  "HOME",
  "LANG",
  "LC_ALL",
  "PATH",
  "TERM",
  "TMPDIR",
];

/** @param {BuildEnvironmentSource} source */
export function buildSanitizedEnvironment(source = process.env) {
  /** @type {Record<string, string>} */
  const environment = {};

  for (const key of PASSTHROUGH_ENV_KEYS) {
    if (source[key] !== undefined) environment[key] = source[key];
  }

  return { ...environment, ...SAFE_BUILD_ENVIRONMENT };
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const nextBin = fileURLToPath(
    new URL("../node_modules/next/dist/bin/next", import.meta.url),
  );
  const child = spawn(process.execPath, [nextBin, "build", ...process.argv.slice(2)], {
    cwd: process.cwd(),
    env: buildSanitizedEnvironment(),
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.exitCode = signal === "SIGINT" ? 130 : 143;
      return;
    }
    process.exitCode = code ?? 1;
  });
}
