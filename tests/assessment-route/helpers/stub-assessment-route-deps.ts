import nodeModule from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { stubServerOnly } from "../../regression/helpers/stub-server-only";
import type { Types } from "mongoose";

type ResolveResult = { url: string; format?: string | null; shortCircuit?: boolean };
type RegisterHooks = (hooks: {
  resolve: (
    specifier: string,
    context: unknown,
    nextResolve: (specifier: string, context?: unknown) => ResolveResult
  ) => ResolveResult;
}) => unknown;

type ActiveSchoolStub =
  | undefined
  | {
      ok: false;
      reason: string;
    }
  | {
      ok: true;
      context: {
        userId: Types.ObjectId;
        schoolId: Types.ObjectId;
        roles: string[];
      };
    };

type PremiumDecision =
  | { allowed: true }
  | { allowed: false; reason: string; statusCode: number };

let registered = false;

export function setAssessmentRouteActiveSchool(state: ActiveSchoolStub) {
  (globalThis as { __assessmentRouteActiveSchool?: ActiveSchoolStub }).__assessmentRouteActiveSchool = state;
}

export function setAssessmentRoutePremiumDecision(decision: PremiumDecision) {
  (globalThis as { __assessmentRoutePremiumDecision?: PremiumDecision }).__assessmentRoutePremiumDecision = decision;
}

export function stubAssessmentRouteDeps() {
  stubServerOnly();
  if (registered) return;
  const registerHooks = (nodeModule as unknown as { registerHooks?: RegisterHooks }).registerHooks;
  if (typeof registerHooks !== "function") {
    throw new Error("module.registerHooks is unavailable; use Node >= 22.15");
  }
  const stubs = {
    "@/lib/auth/active-school-context": "tests/assessment-route/helpers/stubs/active-school-context.cjs",
    "@/lib/subscriptions/assess-premium": "tests/assessment-route/helpers/stubs/assess-premium.cjs",
  };
  const urls = Object.fromEntries(
    Object.entries(stubs).map(([specifier, file]) => [
      specifier,
      pathToFileURL(path.resolve(process.cwd(), file)).href,
    ])
  );
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const url = urls[specifier as keyof typeof urls];
      if (url) return { url, format: "commonjs", shortCircuit: true };
      return nextResolve(specifier, context);
    },
  });
  registered = true;
}
