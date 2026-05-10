import mongoose from "mongoose";
import { School } from "@/models/School";
import { SchoolSettings } from "@/models/SchoolSettings";

export async function assertSchemeOfWorkEnabled(
  schoolId: mongoose.Types.ObjectId
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const settings = await SchoolSettings.findOne({ schoolId })
    .select("academicPlanning")
    .lean();
  if (!settings?.academicPlanning?.enableSchemeOfWork) {
    return { ok: false, status: 403, error: "Scheme of work is not enabled for this school" };
  }
  return { ok: true };
}

export async function assertTeacherSchemeCreationEnabled(
  schoolId: mongoose.Types.ObjectId,
  isAdmin: boolean
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const settings = await SchoolSettings.findOne({ schoolId })
    .select("academicPlanning")
    .lean();
  const ap = settings?.academicPlanning;
  if (!ap?.enableSchemeOfWork) {
    return { ok: false, status: 403, error: "Scheme of work is not enabled for this school" };
  }
  if (!isAdmin && !ap?.allowTeacherSchemeCreation) {
    return {
      ok: false,
      status: 403,
      error: "Teacher scheme creation is disabled for this school",
    };
  }
  return { ok: true };
}

export async function assertSchemeImportEnabled(
  schoolId: mongoose.Types.ObjectId
): Promise<
  { ok: true } | { ok: false; status: number; error: string }
> {
  const [settings, school] = await Promise.all([
    SchoolSettings.findOne({ schoolId }).select("academicPlanning").lean(),
    School.findById(schoolId).select("curriculumCode").lean(),
  ]);
  if (!school) {
    return { ok: false, status: 404, error: "School not found" };
  }
  if ((school.curriculumCode || "ghana_nacca") !== "ghana_nacca") {
    return {
      ok: false,
      status: 403,
      error: "Scheme import is only available for Ghana NaCCA schools",
    };
  }
  const ap = settings?.academicPlanning;
  if (!ap?.enableSchemeOfWork) {
    return { ok: false, status: 403, error: "Scheme of work is not enabled for this school" };
  }
  if (!ap?.allowSchemeImport) {
    return { ok: false, status: 403, error: "Scheme import is not allowed for this school" };
  }
  return { ok: true };
}

/** Requires `enableSchemeOfWork` plus `allowAiSchemeDrafting`. */
export async function assertAiSchemeDraftingEnabled(
  schoolId: mongoose.Types.ObjectId
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const settings = await SchoolSettings.findOne({ schoolId }).select("academicPlanning").lean();
  const ap = settings?.academicPlanning;
  if (!ap?.enableSchemeOfWork) {
    return { ok: false, status: 403, error: "Scheme of work is not enabled for this school" };
  }
  if (!ap?.allowAiSchemeDrafting) {
    return {
      ok: false,
      status: 403,
      error: "AI-assisted scheme drafting is not enabled for this school",
    };
  }
  return { ok: true };
}

/** PDF import follows the base scheme-import gate. */
export async function assertPdfSchemeImportEnabled(
  schoolId: mongoose.Types.ObjectId
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  return assertSchemeImportEnabled(schoolId);
}

/** Only UploadThing / utfs assets (prevents SSRF on arbitrary URLs). */
export function isTrustedSchemeImportFileUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === "utfs.io" || host.endsWith(".utfs.io")) return true;
    if (host === "ufs.sh" || host.endsWith(".ufs.sh")) return true;
    if (host.includes("uploadthing.com")) return true;
    if (host.includes("uploadthing") && host.endsWith("com")) return true;
    if (u.protocol === "https:" && host === "localhost") return process.env.NODE_ENV === "development";
    return false;
  } catch {
    return false;
  }
}
