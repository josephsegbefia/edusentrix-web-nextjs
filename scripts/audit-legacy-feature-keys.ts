#!/usr/bin/env tsx
/**
 * audit-legacy-feature-keys.ts
 *
 * Scans the EduSentrix source tree for legacy flat feature key strings
 * that were used before the canonical dotted-key registry was introduced.
 *
 * Run:   npx tsx scripts/audit-legacy-feature-keys.ts
 * Or:    pnpm tsx scripts/audit-legacy-feature-keys.ts
 *
 * Exits with code 1 if any legacy keys are found in active source files.
 */

import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Legacy keys to detect (from spec §25.4 migration map)
// ---------------------------------------------------------------------------
const LEGACY_KEYS: string[] = [
  "core_school_ops",
  "ai_lesson_notes",
  "ai_leo_copilot",
  "curriculum_scheme",
  "edusentrix_learn",
  "lesson_notes",
  "community_hub",
  "api_access",
  "priority_support",
  // Old Paystack billing keys that may appear as feature strings
  "trial",
  "trialing",
];

// Also flag usage of hasTierFeature() and old resolveTierLimits() imports
const LEGACY_FUNCTIONS: string[] = [
  "hasTierFeature",
  "resolveTierLimits",
  "FEATURE_ALIASES",
];

// ---------------------------------------------------------------------------
// Directories to scan
// ---------------------------------------------------------------------------
const SCAN_DIRS = ["src/app", "src/components", "src/hooks", "src/lib", "src/models"];

// Exclude these subdirs (build output, external modules, the new subscriptions module)
const EXCLUDE_PATTERNS = [
  "node_modules",
  ".next",
  "src/lib/subscriptions", // new canonical module — skip
  "scripts",               // skip self
];

// File extensions to inspect
const INCLUDE_EXTENSIONS = new Set([".ts", ".tsx"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shouldSkip(filePath: string): boolean {
  return EXCLUDE_PATTERNS.some((p) => filePath.includes(p));
}

function* walkDir(dir: string): Generator<string> {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (shouldSkip(full)) continue;
    if (entry.isDirectory()) {
      yield* walkDir(full);
    } else if (INCLUDE_EXTENSIONS.has(path.extname(entry.name))) {
      yield full;
    }
  }
}

interface Hit {
  file: string;
  line: number;
  col: number;
  match: string;
  kind: "legacy_key" | "legacy_function";
}

function scanFile(filePath: string, hits: Hit[]): void {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const key of LEGACY_KEYS) {
      // Look for key as a quoted string value (not a variable name that happens to contain the chars)
      const patterns = [`"${key}"`, `'${key}'`, `\`${key}\``];
      for (const pattern of patterns) {
        const col = line.indexOf(pattern);
        if (col !== -1) {
          hits.push({
            file: filePath,
            line: i + 1,
            col: col + 1,
            match: pattern,
            kind: "legacy_key",
          });
        }
      }
    }

    for (const fn of LEGACY_FUNCTIONS) {
      const col = line.indexOf(fn);
      if (col !== -1) {
        hits.push({
          file: filePath,
          line: i + 1,
          col: col + 1,
          match: fn,
          kind: "legacy_function",
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const root = path.resolve(process.cwd());
  const hits: Hit[] = [];

  for (const dir of SCAN_DIRS) {
    const full = path.join(root, dir);
    for (const file of walkDir(full)) {
      scanFile(file, hits);
    }
  }

  if (hits.length === 0) {
    console.log("✅  audit:legacy-feature-keys — no legacy feature keys found.");
    process.exit(0);
  }

  console.error(`\n❌  audit:legacy-feature-keys — found ${hits.length} legacy reference(s):\n`);

  let lastFile = "";
  for (const hit of hits) {
    const rel = path.relative(root, hit.file);
    if (rel !== lastFile) {
      console.error(`  📄 ${rel}`);
      lastFile = rel;
    }
    const kindLabel = hit.kind === "legacy_key" ? "LEGACY KEY" : "LEGACY FN ";
    console.error(`       [${kindLabel}] Line ${hit.line}:${hit.col} — ${hit.match}`);
  }

  console.error(`
  To fix:
  1. Replace legacy key strings with canonical FEATURE_KEYS.* values from src/lib/subscriptions/feature-keys.ts
  2. Replace hasTierFeature() / resolveTierLimits() with the new entitlement resolver.
  3. Remove FEATURE_ALIASES from old billing helpers.
  See spec §25.4 for the full migration map.
`);

  process.exit(1);
}

main();
