/**
 * Lets tests call the real storage route handlers without Clerk by redirecting
 * the active-school resolver and subscription guards to test-only stubs. Must
 * run before the route modules are imported.
 */
import nodeModule from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Types } from "mongoose";
import { stubServerOnly } from "../../regression/helpers/stub-server-only";

type ResolveResult = { url: string; format?: string | null; shortCircuit?: boolean };
type RegisterHooks = (hooks: {
  resolve: (
    specifier: string,
    context: unknown,
    nextResolve: (specifier: string, context?: unknown) => ResolveResult
  ) => ResolveResult;
}) => unknown;

const STUBS: Record<string, string> = {
  "@/lib/auth/active-school-context": "tests/storage/helpers/stubs/active-school-context.cjs",
  "@/lib/subscriptions/guards": "tests/regression/helpers/stubs/subscription-guards.cjs",
};

let registered = false;

export type ActiveSchoolStub =
  | undefined
  | { throwStatus: 403 }
  | { ok: false; reason: string }
  | {
      ok: true;
      context: {
        userId: Types.ObjectId;
        schoolId: Types.ObjectId;
        roles: string[];
        source: "single_membership" | "assisted_access";
      };
    };

export function setActiveSchool(state: ActiveSchoolStub) {
  (globalThis as { __storageActiveSchool?: ActiveSchoolStub }).__storageActiveSchool = state;
}

export function stubStorageRouteDeps() {
  stubServerOnly();
  if (registered) return;
  const registerHooks = (nodeModule as unknown as { registerHooks?: RegisterHooks }).registerHooks;
  if (typeof registerHooks !== "function") {
    throw new Error("module.registerHooks is unavailable; use Node >= 22.15");
  }
  const urls = Object.fromEntries(
    Object.entries(STUBS).map(([specifier, file]) => [
      specifier,
      pathToFileURL(path.resolve(process.cwd(), file)).href,
    ])
  );
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const url = urls[specifier];
      if (url) return { url, format: "commonjs", shortCircuit: true };
      return nextResolve(specifier, context);
    },
  });
  registered = true;
}
