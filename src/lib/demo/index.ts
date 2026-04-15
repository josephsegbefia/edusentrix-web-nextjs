export { isDemoHost, isDemoMode, isClientDemoMode, DEMO_CONFIG } from "./runtime";
export { enforceDemoPolicy, getDemoActionPolicy, DemoActionBlockedError, getAllDemoPolicies } from "./action-policy";
export type { DemoActionPolicy, DemoActionDisposition } from "./action-policy";
export { trackDemoEvent, DEMO_EVENT_CODES } from "./telemetry";
export { buildCoverageMatrix } from "./coverage-matrix";
export type { CoverageMatrix, CoverageEntry } from "./coverage-matrix";
