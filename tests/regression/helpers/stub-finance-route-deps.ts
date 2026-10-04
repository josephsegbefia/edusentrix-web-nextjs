/**
 * Lets tests call the real fee route handlers without Clerk or subscription
 * lookups by redirecting their auth/entitlement imports to test-only stubs
 * (see ./stubs). Must run before the route modules are imported.
 */
import nodeModule from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { stubServerOnly } from "./stub-server-only";

type ResolveResult = { url: string; format?: string | null; shortCircuit?: boolean };
type RegisterHooks = (hooks: {
  resolve: (
    specifier: string,
    context: unknown,
    nextResolve: (specifier: string, context?: unknown) => ResolveResult
  ) => ResolveResult;
}) => unknown;

const STUBS: Record<string, string> = {
  "@/lib/auth/requireFinanceStaff": "require-finance-staff.cjs",
  "@/lib/subscriptions/guards": "subscription-guards.cjs",
  "@/lib/delegations/requireDelegatedModulePermission": "delegated-module-permission.cjs",
};

let registered = false;

export type FinanceRouteTestContext = { schoolId: unknown; userId: unknown };

export function setFinanceRouteContext(ctx: FinanceRouteTestContext) {
  (globalThis as { __financeRouteTestContext?: FinanceRouteTestContext }).__financeRouteTestContext = ctx;
}

export function stubFinanceRouteDeps() {
  stubServerOnly();
  if (registered) return;
  const registerHooks = (nodeModule as unknown as { registerHooks?: RegisterHooks }).registerHooks;
  if (typeof registerHooks !== "function") {
    throw new Error("module.registerHooks is unavailable; use Node >= 22.15");
  }
  const stubsDir = path.resolve(process.cwd(), "tests/regression/helpers/stubs");
  const urls = Object.fromEntries(
    Object.entries(STUBS).map(([specifier, file]) => [
      specifier,
      pathToFileURL(path.join(stubsDir, file)).href,
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
