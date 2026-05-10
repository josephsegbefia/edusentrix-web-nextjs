import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { createSchemeImportJobFromUpload } from "@/lib/schemes/scheme-import-create";

const PostBodySchema = z.object({
  fileUrl: z.string().url(),
  fileName: z.string().trim().min(1).max(400),
  fileKey: z.string().trim().max(500).optional(),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireTeacher();
    if (!can(ctx.permissions, PERMISSIONS.schemeImportUpload)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const parsed = PostBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const result = await createSchemeImportJobFromUpload({
      schoolId: ctx.schoolId,
      createdByUserId: ctx.userId,
      fileUrl: parsed.data.fileUrl,
      fileName: parsed.data.fileName,
      fileKey: parsed.data.fileKey ?? null,
    });

    if (!result.ok) {
      return Response.json({ success: false, error: result.error }, { status: result.status });
    }

    return Response.json({
      success: true,
      data: { job: result.job },
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    );
  }
}
