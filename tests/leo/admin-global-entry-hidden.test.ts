import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, "../..");

test("BI.0 keeps the unfinished global Ask Leo entry unmounted", () => {
  const layout = readFileSync(
    resolve(repositoryRoot, "src/app/(app)/admin/layout.tsx"),
    "utf8"
  );
  const entry = readFileSync(
    resolve(repositoryRoot, "src/components/leo/AdminLeoEntry.tsx"),
    "utf8"
  );

  assert.doesNotMatch(layout, /AdminLeoEntry/);
  assert.match(entry, /export function AdminLeoEntry/);
});
