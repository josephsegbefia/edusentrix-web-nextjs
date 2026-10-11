import { Types } from "mongoose";
import { StoredAsset } from "@/models/StoredAsset";
import { Student } from "@/models/Student";
import { parseStoredAssetId } from "./urls";

/**
 * Metadata clean-up for existing student photographs. It marks every
 * `student_avatar` private and links each unlinked asset to the single student
 * in its school whose `photoUrl` points at it. It never changes another kind,
 * never relinks an asset, and never touches stored objects. Access control does
 * not depend on it: the kind rule already treats these assets as private.
 */

type Association = { type: string; id: string };

export type StudentAvatarChange = {
  assetId: string;
  schoolId: string;
  previousVisibility: string;
  previousAssociation: Association | null;
  linkStudentId: string | null;
};

export type StudentAvatarMigrationPlan = {
  counts: {
    assets: number;
    byVisibility: Record<string, number>;
    linkedToStudent: number;
    linkedToOther: number;
    linkable: number;
    ambiguous: number;
    unreferenced: number;
    crossSchoolReferences: number;
    studentPhotoUrl: { none: number; internalAsset: number; external: number; other: number };
  };
  ambiguousAssetIds: string[];
  changes: StudentAvatarChange[];
};

export type StudentAvatarManifest = {
  version: 1;
  createdAt: string;
  entries: StudentAvatarChange[];
};

type StudentRef = { schoolId: string; studentId: string };

async function collectStudentReferences(plan: StudentAvatarMigrationPlan) {
  const refs = new Map<string, StudentRef[]>();
  const cursor = Student.find({})
    .select({ _id: 1, schoolId: 1, photoUrl: 1 })
    .lean<{ _id: Types.ObjectId; schoolId: Types.ObjectId; photoUrl?: string | null }>()
    .cursor();
  for await (const student of cursor) {
    const photoUrl = typeof student.photoUrl === "string" ? student.photoUrl.trim() : "";
    const counts = plan.counts.studentPhotoUrl;
    if (!photoUrl) {
      counts.none += 1;
      continue;
    }
    const assetId = parseStoredAssetId(photoUrl);
    if (assetId) {
      counts.internalAsset += 1;
      const list = refs.get(assetId) ?? [];
      list.push({ schoolId: String(student.schoolId), studentId: String(student._id) });
      refs.set(assetId, list);
    } else if (/^https?:\/\//i.test(photoUrl)) {
      counts.external += 1;
    } else {
      counts.other += 1;
    }
  }
  return refs;
}

/** Read-only. Counts what an apply would do and lists the changes. */
export async function planStudentAvatarMigration(): Promise<StudentAvatarMigrationPlan> {
  const plan: StudentAvatarMigrationPlan = {
    counts: {
      assets: 0,
      byVisibility: {},
      linkedToStudent: 0,
      linkedToOther: 0,
      linkable: 0,
      ambiguous: 0,
      unreferenced: 0,
      crossSchoolReferences: 0,
      studentPhotoUrl: { none: 0, internalAsset: 0, external: 0, other: 0 },
    },
    ambiguousAssetIds: [],
    changes: [],
  };
  const refs = await collectStudentReferences(plan);

  const cursor = StoredAsset.find({ kind: "student_avatar" })
    .select({ _id: 1, schoolId: 1, visibility: 1, association: 1 })
    .lean<{
      _id: Types.ObjectId;
      schoolId: Types.ObjectId;
      visibility: string;
      association?: { type: string; id: Types.ObjectId } | null;
    }>()
    .cursor();

  for await (const asset of cursor) {
    const assetId = String(asset._id);
    const schoolId = String(asset.schoolId);
    plan.counts.assets += 1;
    plan.counts.byVisibility[asset.visibility] = (plan.counts.byVisibility[asset.visibility] ?? 0) + 1;

    const all = refs.get(assetId) ?? [];
    const sameSchool = all.filter((ref) => ref.schoolId === schoolId);
    plan.counts.crossSchoolReferences += all.length - sameSchool.length;

    let linkStudentId: string | null = null;
    if (asset.association) {
      if (asset.association.type === "student") plan.counts.linkedToStudent += 1;
      else plan.counts.linkedToOther += 1;
    } else if (sameSchool.length === 1) {
      plan.counts.linkable += 1;
      linkStudentId = sameSchool[0].studentId;
    } else if (sameSchool.length > 1) {
      plan.counts.ambiguous += 1;
      plan.ambiguousAssetIds.push(assetId);
    } else {
      plan.counts.unreferenced += 1;
    }

    if (asset.visibility !== "private" || linkStudentId) {
      plan.changes.push({
        assetId,
        schoolId,
        previousVisibility: asset.visibility,
        previousAssociation: asset.association
          ? { type: asset.association.type, id: String(asset.association.id) }
          : null,
        linkStudentId,
      });
    }
  }
  return plan;
}

export function buildManifest(plan: StudentAvatarMigrationPlan, now = new Date()): StudentAvatarManifest {
  return { version: 1, createdAt: now.toISOString(), entries: plan.changes };
}

/**
 * Applies the planned changes. Each update is conditional on the asset still
 * looking the way the plan saw it, so a concurrent edit is skipped, not
 * overwritten. Safe to rerun: a second plan has no changes.
 */
export async function applyStudentAvatarMigration(
  changes: StudentAvatarChange[]
): Promise<{ updated: number; skipped: number }> {
  let updated = 0;
  let skipped = 0;
  for (const change of changes) {
    const filter: Record<string, unknown> = {
      _id: new Types.ObjectId(change.assetId),
      kind: "student_avatar",
      visibility: change.previousVisibility,
    };
    const set: Record<string, unknown> = { visibility: "private" };
    if (change.linkStudentId) {
      filter.association = null;
      set.association = { type: "student", id: new Types.ObjectId(change.linkStudentId) };
    }
    const result = await StoredAsset.updateOne(filter, { $set: set });
    if (result.modifiedCount > 0) updated += 1;
    else skipped += 1;
  }
  return { updated, skipped };
}

/**
 * Restores visibility and removes only the links this migration added. An
 * asset that has since been relinked keeps its newer link.
 */
export async function rollbackStudentAvatarMigration(
  manifest: StudentAvatarManifest
): Promise<{ restored: number; skipped: number }> {
  if (manifest.version !== 1 || !Array.isArray(manifest.entries)) {
    throw new Error("Unrecognised manifest");
  }
  let restored = 0;
  let skipped = 0;
  for (const entry of manifest.entries) {
    const _id = new Types.ObjectId(entry.assetId);
    const visibility = await StoredAsset.updateOne(
      { _id, kind: "student_avatar", visibility: "private" },
      { $set: { visibility: entry.previousVisibility } }
    );
    let unlinked = { modifiedCount: 0 };
    if (entry.linkStudentId) {
      unlinked = await StoredAsset.updateOne(
        {
          _id,
          kind: "student_avatar",
          "association.type": "student",
          "association.id": new Types.ObjectId(entry.linkStudentId),
        },
        { $set: { association: null } }
      );
    }
    if (visibility.modifiedCount > 0 || unlinked.modifiedCount > 0) restored += 1;
    else skipped += 1;
  }
  return { restored, skipped };
}
