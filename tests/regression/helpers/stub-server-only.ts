/**
 * Lets `npm test` (plain `node --test --import tsx`) load server modules that
 * import `server-only`. Next.js resolves that package to a no-op under the
 * `react-server` condition; this maps it to the same no-op file for tests.
 *
 * Must run before any module that imports `server-only` is resolved, so test
 * files call it first and then load `src` modules with dynamic `import()`.
 */
import nodeModule from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

type ResolveResult = { url: string; format?: string | null; shortCircuit?: boolean };
type RegisterHooks = (hooks: {
  resolve: (
    specifier: string,
    context: unknown,
    nextResolve: (specifier: string, context?: unknown) => ResolveResult
  ) => ResolveResult;
}) => unknown;

let registered = false;

export function stubServerOnly() {
  if (registered) return;
  const registerHooks = (nodeModule as unknown as { registerHooks?: RegisterHooks }).registerHooks;
  if (typeof registerHooks !== "function") {
    throw new Error("module.registerHooks is unavailable; use Node >= 22.15 or run with --conditions=react-server");
  }
  const emptyUrl = pathToFileURL(
    path.resolve(process.cwd(), "node_modules/server-only/empty.js")
  ).href;
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "server-only") {
        return { url: emptyUrl, format: "commonjs", shortCircuit: true };
      }
      return nextResolve(specifier, context);
    },
  });
  registered = true;
}
