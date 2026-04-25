/**
 * Leo Copilot runtime kill-switches (spec §8.1).
 * Server routes must use {@link isLeoCopilotServerRuntimeEnabled}.
 * Client UI must use {@link isLeoCopilotClientRuntimeEnabled} so the launcher stays hidden
 * when the public flag is off.
 */
export function isLeoCopilotServerRuntimeEnabled(): boolean {
  return process.env.FEATURE_LEO_COPILOT_RUNTIME_ENABLED === "true";
}

export function isLeoCopilotClientRuntimeEnabled(): boolean {
  if (typeof process.env.NEXT_PUBLIC_FEATURE_LEO_COPILOT_RUNTIME_ENABLED === "undefined") {
    return false;
  }
  return process.env.NEXT_PUBLIC_FEATURE_LEO_COPILOT_RUNTIME_ENABLED === "true";
}
