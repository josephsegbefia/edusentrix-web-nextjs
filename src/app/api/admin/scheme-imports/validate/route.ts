import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { PERMISSIONS } from "@/lib/rbac";
import {
  assertPdfSchemeImportEnabled,
  assertSchemeImportEnabled,
} from "@/lib/schemes/scheme-import-gate";
import { isPdfSource } from "@/lib/schemes/scheme-import-pdf-utils";
import {
  SCHEME_IMPORT_MAX_UPLOAD_BYTES,
  validateSchemeImportFileBuffer,
} from "@/lib/schemes/scheme-import-validate-file";

export async function POST(req: Request) {
  try {
    const ctx = await requireSchoolAdminOrDelegatedAnyPermission([
      PERMISSIONS.schemeImportUpload,
      PERMISSIONS.schemeOfWorkCreate,
      PERMISSIONS.schemeOfWorkReview,
    ]);

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    if (file.size > SCHEME_IMPORT_MAX_UPLOAD_BYTES) {
      return Response.json(
        {
          success: false,
          error: `File is too large. Maximum size is ${Math.round(SCHEME_IMPORT_MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`,
        },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const importGate = await assertSchemeImportEnabled(ctx.schoolId);
    if (!importGate.ok) {
      return Response.json({ success: false, error: importGate.error }, { status: importGate.status });
    }

    const fileName = file.name || "scheme-import";
    const mimeType = file.type || null;
    const pdfMode = isPdfSource(fileName, mimeType ?? undefined);

    if (pdfMode) {
      const pdfGate = await assertPdfSchemeImportEnabled(ctx.schoolId);
      if (!pdfGate.ok) {
        return Response.json({ success: false, error: pdfGate.error }, { status: pdfGate.status });
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = await validateSchemeImportFileBuffer(buffer, fileName, mimeType);

    if (!validation.ok) {
      return Response.json(
        {
          success: false,
          error: validation.error,
          missingColumns: validation.missingColumns ?? null,
        },
        { status: 422 },
      );
    }

    return Response.json({ success: true, data: { valid: true } });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Validation failed" },
      { status: 500 },
    );
  }
}
