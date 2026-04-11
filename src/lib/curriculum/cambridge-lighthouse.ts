/**
 * Phase 3 — International lighthouse profile (Cambridge export slice).
 * Gate server-side with FEATURE_CAMBRIDGE_LIGHTHOUSE_EXPORT=true — no client-only bypass.
 */
export function isCambridgeLighthouseExportFeatureEnabled(): boolean {
  return process.env.FEATURE_CAMBRIDGE_LIGHTHOUSE_EXPORT === "true";
}
