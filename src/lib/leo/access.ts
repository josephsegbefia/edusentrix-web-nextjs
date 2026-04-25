import mongoose from "mongoose";
import { hasFeature } from "@/lib/billing/entitlements";
import { mergeSchoolLeo } from "@/lib/leo/defaults";
import { getLeoPlatformConfig, type LeoPlatformConfig } from "@/lib/leo/platform-flag";
import { isLeoCopilotServerRuntimeEnabled } from "@/lib/leo/runtime";
import type { SchoolLeoSettingsDTO, LeoAccessResolution } from "@/lib/leo/types";
import { LEO_ENTITLEMENT_KEY } from "@/lib/leo/types";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SchoolSettings } from "@/models/SchoolSettings";

function leoRoleKey(
  role: string | undefined
): keyof NonNullable<SchoolLeoSettingsDTO["roleOverrides"]> | null {
  switch (role) {
    case "school_admin":
      return "school_admin";
    case "bursar":
      return "bursar";
    case "billing_owner":
      return "billing_owner";
    case "teacher":
      return "teacher";
    case "parent":
      return "parent";
    case "student":
      return "student";
    default:
      return null;
  }
}

function toPlatformSlice(platform: LeoPlatformConfig) {
  return {
    defaultState: platform.defaultState,
    forcedMode: platform.forcedMode,
    allowSchoolOverride: platform.allowSchoolOverride,
    allowSchoolSelfService: platform.allowSchoolSelfService,
  };
}

function applyRoleGate(input: {
  role: string | undefined;
  schoolLeo: SchoolLeoSettingsDTO;
  platform: LeoPlatformConfig;
  entitlement: LeoAccessResolution["entitlement"];
  /** When true, Leo is allowed if the role gate passes. */
  base: boolean;
}): LeoAccessResolution {
  const { role, schoolLeo, platform, entitlement, base } = input;
  const rk = leoRoleKey(role);
  const ro = rk ? schoolLeo.roleOverrides?.[rk] : undefined;

  if (ro === "disabled") {
    return {
      effectiveEnabled: false,
      reason: "disabled_role",
      reasonDetail: "Leo is disabled for this role in school settings.",
      schoolLeo,
      platform: toPlatformSlice(platform),
      entitlement,
    };
  }

  if (ro === "enabled") {
    return {
      effectiveEnabled: true,
      reason: "enabled",
      schoolLeo,
      platform: toPlatformSlice(platform),
      entitlement,
    };
  }

  return {
    effectiveEnabled: base,
    reason: base ? "enabled" : "disabled_school",
    schoolLeo,
    platform: toPlatformSlice(platform),
    entitlement,
  };
}

/**
 * Effective Leo access for a school-scoped user (spec §8.5).
 */
export async function resolveLeoAccess(input: {
  schoolId: mongoose.Types.ObjectId;
  role: string | undefined;
}): Promise<LeoAccessResolution> {
  await connectToDatabase();
  const platform = await getLeoPlatformConfig();

  const settingsDoc = await SchoolSettings.findOne({ schoolId: input.schoolId })
    .select("leo")
    .lean();
  const schoolLeo = mergeSchoolLeo(
    (settingsDoc as { leo?: Record<string, unknown> } | null)?.leo
  );

  const entitlementKey = platform.entitlementKey || LEO_ENTITLEMENT_KEY;
  const hasEntitlement = await hasFeature(input.schoolId, "ai_leo_copilot");
  const entitlementBypass = schoolLeo.entitlementBypass === true;
  const entitlementOK = hasEntitlement || entitlementBypass;
  const entitlement = {
    hasAiLeoCopilot: hasEntitlement,
    bypass: entitlementBypass,
  };

  if (!isLeoCopilotServerRuntimeEnabled()) {
    return {
      effectiveEnabled: false,
      reason: "disabled_runtime",
      reasonDetail: "Set FEATURE_LEO_COPILOT_RUNTIME_ENABLED=true to enable Leo on the server.",
      schoolLeo,
      platform: toPlatformSlice(platform),
      entitlement,
    };
  }

  if (platform.forcedMode === "force_disabled") {
    return {
      effectiveEnabled: false,
      reason: "disabled_platform",
      reasonDetail: "Leo is force-disabled for all schools in platform settings.",
      schoolLeo,
      platform: toPlatformSlice(platform),
      entitlement,
    };
  }

  if (platform.forcedMode === "force_enabled") {
    return applyRoleGate({
      role: input.role,
      schoolLeo,
      platform,
      entitlement,
      base: true,
    });
  }

  if (!entitlementOK) {
    return {
      effectiveEnabled: false,
      reason: "disabled_plan",
      reasonDetail: `Add the "${entitlementKey}" feature to the subscription, or set a school pilot bypass.`,
      schoolLeo,
      platform: toPlatformSlice(platform),
      entitlement,
    };
  }

  const defaultOn = platform.defaultState === "enabled";
  let schoolGate = defaultOn;
  if (schoolLeo.accessOverride === "disabled") {
    return {
      effectiveEnabled: false,
      reason: "disabled_school",
      reasonDetail: "Leo is turned off in school settings.",
      schoolLeo,
      platform: toPlatformSlice(platform),
      entitlement,
    };
  }
  if (schoolLeo.accessOverride === "enabled") {
    schoolGate = true;
  }
  if (!schoolGate) {
    return {
      effectiveEnabled: false,
      reason: "disabled_school",
      reasonDetail: "Set platform default to enabled or set school access to enabled.",
      schoolLeo,
      platform: toPlatformSlice(platform),
      entitlement,
    };
  }

  return applyRoleGate({
    role: input.role,
    schoolLeo,
    platform,
    entitlement,
    base: true,
  });
}
