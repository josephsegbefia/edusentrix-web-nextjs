/**
 * Lets tests call the real approval route handlers without Clerk, demo or assisted-access
 * lookups. The active-school context is replaced, so the real role gates in
 * requireSchoolAdmin / requireFinanceStaff still run. Notifications are recorded, not sent.
 * Must run before the route modules are imported.
 */
import nodeModule from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
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
  "@/lib/auth/active-school-context": "active-school-context.cjs",
  "@clerk/nextjs/server": "clerk-server.cjs",
  "@/lib/demo/guard-integration": "demo-guard.cjs",
  "@/lib/platform/assisted-access/session": "assisted-access-session.cjs",
  "@/lib/lesson-notes/notifications": "lesson-note-notifications.cjs",
};

export type ApprovalTestSession =
  | null
  | { userId: unknown; schoolId: unknown; roles: string[] }
  | { needsSchoolSelection: true };

type TestGlobals = {
  __approvalTestSession?: ApprovalTestSession;
  __approvalNotifications?: Array<{ kind: string; input: unknown }>;
};

export function signIn(session: ApprovalTestSession) {
  (globalThis as TestGlobals).__approvalTestSession = session;
}

export function notifications(): Array<{ kind: string; input: unknown }> {
  const g = globalThis as TestGlobals;
  g.__approvalNotifications ??= [];
  return g.__approvalNotifications;
}

export function resetNotifications() {
  (globalThis as TestGlobals).__approvalNotifications = [];
}

let registered = false;

export function stubApprovalRouteDeps() {
  stubServerOnly();
  if (registered) return;
  const registerHooks = (nodeModule as unknown as { registerHooks?: RegisterHooks }).registerHooks;
  if (typeof registerHooks !== "function") {
    throw new Error("module.registerHooks is unavailable; use Node >= 22.15");
  }
  const stubsDir = path.resolve(process.cwd(), "tests/approvals/helpers/stubs");
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
