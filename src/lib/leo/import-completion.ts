/**
 * Compatibility wrapper for older import adapters. New import code should
 * call `runLeoImportIntelligence` directly from the shared boundary.
 */
export {
  runLeoImportIntelligence as runImportLeoStructured,
  type RunLeoImportIntelligenceInput,
  type RunLeoImportIntelligenceResult,
} from "@/lib/import-intelligence/leo";
export type { ImportLeoMetadata } from "@/lib/import-intelligence/types";
