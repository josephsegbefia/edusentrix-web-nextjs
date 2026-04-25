import type { IPlatformFeatureFlag } from "@/models/PlatformFeatureFlag";
import { LEO_ENTITLEMENT_KEY, LEO_FEATURE_FLAG_KEY } from "@/lib/leo/types";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PlatformFeatureFlag } from "@/models/PlatformFeatureFlag";

const DEFAULT_LABEL = "Leo Copilot";

const SYNTHETIC: Omit<IPlatformFeatureFlag, "_id" | "createdAt" | "updatedAt"> = {
  key: LEO_FEATURE_FLAG_KEY,
  label: DEFAULT_LABEL,
  description: "Unified assistant across EduSentrix (spec LEO v1).",
  defaultState: "disabled",
  forcedMode: "none",
  allowSchoolOverride: true,
  allowSchoolSelfService: false,
  entitlementKey: LEO_ENTITLEMENT_KEY,
  rolloutNotes: null,
  updatedBy: null,
};

export type LeoPlatformConfig = Pick<
  IPlatformFeatureFlag,
  | "key"
  | "label"
  | "defaultState"
  | "forcedMode"
  | "allowSchoolOverride"
  | "allowSchoolSelfService"
  | "entitlementKey"
  | "rolloutNotes"
> & { persisted: boolean; id: string | null };

/**
 * Return persisted Leo platform flag or a stable default (no auto-insert).
 * Callers create the document via `upsertLeoPlatformFlag` from the platform UI.
 */
export async function getLeoPlatformConfig(): Promise<LeoPlatformConfig> {
  await connectToDatabase();
  const doc = await PlatformFeatureFlag.findOne({ key: LEO_FEATURE_FLAG_KEY }).lean();
  if (doc) {
    const p = doc as IPlatformFeatureFlag;
    return {
      persisted: true,
      id: String(p._id),
      key: p.key,
      label: p.label,
      defaultState: p.defaultState,
      forcedMode: p.forcedMode,
      allowSchoolOverride: p.allowSchoolOverride,
      allowSchoolSelfService: p.allowSchoolSelfService,
      entitlementKey: p.entitlementKey ?? LEO_ENTITLEMENT_KEY,
      rolloutNotes: p.rolloutNotes ?? null,
    };
  }
  return {
    persisted: false,
    id: null,
    key: SYNTHETIC.key,
    label: SYNTHETIC.label,
    defaultState: SYNTHETIC.defaultState,
    forcedMode: SYNTHETIC.forcedMode,
    allowSchoolOverride: SYNTHETIC.allowSchoolOverride,
    allowSchoolSelfService: SYNTHETIC.allowSchoolSelfService,
    entitlementKey: SYNTHETIC.entitlementKey,
    rolloutNotes: SYNTHETIC.rolloutNotes,
  };
}

export async function upsertLeoPlatformFlag(
  patch: Partial<
    Pick<
      IPlatformFeatureFlag,
      | "defaultState"
      | "forcedMode"
      | "allowSchoolOverride"
      | "allowSchoolSelfService"
      | "rolloutNotes"
    >
  >,
  updatedBy?: import("mongoose").Types.ObjectId | null
): Promise<IPlatformFeatureFlag> {
  await connectToDatabase();
  const doc = await PlatformFeatureFlag.findOneAndUpdate(
    { key: LEO_FEATURE_FLAG_KEY },
    {
      $set: {
        ...patch,
        ...(updatedBy ? { updatedBy } : {}),
        label: DEFAULT_LABEL,
        key: LEO_FEATURE_FLAG_KEY,
        entitlementKey: LEO_ENTITLEMENT_KEY,
      },
      $setOnInsert: {
        description: SYNTHETIC.description,
      },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();
  return doc as IPlatformFeatureFlag;
}