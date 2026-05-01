import mongoose from "mongoose";
import { SchoolSettings } from "@/models/SchoolSettings";

export async function assertSchemeImportEnabled(
  schoolId: mongoose.Types.ObjectId
): Promise<
  { ok: true } | { ok: false; status: number; error: string }
> {
  const settings = await SchoolSettings.findOne({ schoolId })
    .select("academicPlanning")
    .lean();
  const ap = settings?.academicPlanning;
  if (!ap?.enableSchemeOfWork) {
    return { ok: false, status: 403, error: "Scheme of work is not enabled for this school" };
  }
  if (!ap?.allowSchemeImport) {
    return { ok: false, status: 403, error: "Scheme import is not allowed for this school" };
  }
  return { ok: true };
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
