import { connectToDatabase } from "@/db/connectToDatabase";
import { SchoolSettings } from "@/models/SchoolSettings";
import { PlatformFeatureFlag } from "@/models/PlatformFeatureFlag";
import { Types } from "mongoose";
import type { ImportLeoAccessReasonCode, ImportLeoAccessResult } from "./types";

export const IMPORT_LEO_FEATURE_FLAG_KEY = "leo_import_assist";

type ImportPlatformState = { enabled: boolean; forcedDisabled?: boolean };

function result(reasonCode: ImportLeoAccessReasonCode): ImportLeoAccessResult {
  return {
    available: reasonCode === "available",
    reasonCode,
    retryable: reasonCode === "provider_unavailable" || reasonCode === "provider_not_configured",
  };
}

export async function getImportLeoPlatformState(): Promise<ImportPlatformState> {
  await connectToDatabase();
  const flag = await PlatformFeatureFlag.findOne({ key: IMPORT_LEO_FEATURE_FLAG_KEY }).select("defaultState forcedMode").lean();
  if (!flag) return { enabled: true, forcedDisabled: false };
  if (flag.forcedMode === "force_disabled") return { enabled: false, forcedDisabled: true };
  return { enabled: flag.defaultState !== "disabled", forcedDisabled: false };
}

export async function hasSchoolImportPrivacyOptOut(schoolId: Types.ObjectId): Promise<boolean> {
  await connectToDatabase();
  const settings = await SchoolSettings.findOne({ schoolId }).lean() as Record<string, unknown> | null;
  const candidates = [
    (settings?.aiPrivacy as Record<string, unknown> | undefined)?.externalProcessingOptOut,
    (settings?.privacy as Record<string, unknown> | undefined)?.externalAiOptOut,
    (settings?.leo as Record<string, unknown> | undefined)?.importExternalAiOptOut,
  ];
  return candidates.some((value) => value === true);
}

export async function resolveImportLeoAccess(input: {
  schoolId: Types.ObjectId;
  authorized: boolean;
  providerConfigured?: boolean;
  privacyOptOut?: boolean;
  platform?: ImportPlatformState;
}): Promise<ImportLeoAccessResult> {
  if (!input.authorized) return result("unauthorized");
  if (process.env.FEATURE_LEO_IMPORT_RUNTIME_ENABLED === "false") return result("runtime_disabled");
  let platform: ImportPlatformState;
  let privacyOptOut: boolean;
  try {
    platform = input.platform ?? await getImportLeoPlatformState();
    privacyOptOut = input.privacyOptOut ?? (input.platform ? false : await hasSchoolImportPrivacyOptOut(input.schoolId));
  } catch {
    // Import analysis must fall back to deterministic review when the capability
    // control plane is unavailable; it must not turn a valid upload into a retry.
    return result("provider_unavailable");
  }
  if (!platform.enabled || platform.forcedDisabled) return result("platform_disabled");
  if (privacyOptOut) return result("privacy_disabled");
  const providerConfigured = input.providerConfigured ?? Boolean(process.env.OPENAI_API_KEY);
  if (!providerConfigured) return result("provider_not_configured");
  return result("available");
}
