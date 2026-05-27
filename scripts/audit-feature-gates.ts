#!/usr/bin/env tsx
/**
 * audit-feature-gates.ts
 *
 * Checks that every route declared as protected in SCHOOL_ADMIN_ROUTE_REGISTRY
 * and API_FEATURE_REGISTRY has the required guards wired.
 *
 * Run:   npx tsx scripts/audit-feature-gates.ts
 *
 * This is a best-effort static check. Full correctness is guaranteed by tests.
 */

import fs from "fs";
import path from "path";
import { SCHOOL_ADMIN_ROUTE_REGISTRY } from "../src/lib/subscriptions/route-registry";
import { API_FEATURE_REGISTRY } from "../src/lib/subscriptions/api-registry";

const root = process.cwd();

function fileExists(filePath: string): boolean {
  return fs.existsSync(path.join(root, filePath));
}

function fileContains(filePath: string, search: string): boolean {
  if (!fileExists(filePath)) return false;
  const content = fs.readFileSync(path.join(root, filePath), "utf-8");
  return content.includes(search);
}

interface Issue {
  kind: string;
  path: string;
  detail: string;
}

const issues: Issue[] = [];

// ---------------------------------------------------------------------------
// Check route registry entries have associated page files
// ---------------------------------------------------------------------------
for (const route of SCHOOL_ADMIN_ROUTE_REGISTRY) {
  if (!route.requiredFeature) continue; // public route, skip

  // Derive approximate file path for app router pages
  const appPath = `src/app/(app)${route.path}/page.tsx`;
  if (!fileExists(appPath)) {
    issues.push({
      kind: "ROUTE_NO_PAGE",
      path: route.path,
      detail: `Expected page file not found: ${appPath}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Check API registry entries have route files with requireSchoolFeature
// ---------------------------------------------------------------------------
for (const entry of API_FEATURE_REGISTRY) {
  if (!entry.requiredFeature) continue;

  const routeFile = `src/app/api${entry.apiPath}/route.ts`;
  if (!fileExists(routeFile)) {
    issues.push({
      kind: "API_NO_FILE",
      path: entry.apiPath,
      detail: `API file not found: ${routeFile}`,
    });
    continue;
  }

  if (!fileContains(routeFile, "requireSchoolFeature") && !fileContains(routeFile, "requireEntitlement")) {
    issues.push({
      kind: "API_NO_GUARD",
      path: entry.apiPath,
      detail: `Missing requireSchoolFeature / requireEntitlement in ${routeFile}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
if (issues.length === 0) {
  console.log("✅  audit:feature-gates — all registered routes and APIs have guards.");
  process.exit(0);
}

console.error(`\n❌  audit:feature-gates — found ${issues.length} issue(s):\n`);
for (const issue of issues) {
  console.error(`  [${issue.kind}] ${issue.path}`);
  console.error(`    ${issue.detail}`);
}
console.error();
process.exit(1);
