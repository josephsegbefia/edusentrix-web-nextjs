import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { ReportTemplate } from "@/models/ReportTemplate";
import { School, type ISchool } from "@/models/School";
import { getReportTemplatePreset } from "@/constants/curriculum-report-templates";

export async function GET() {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const templates = await ReportTemplate.find({ schoolId })
      .sort({ isDefault: -1, name: 1 })
      .lean();

    if (templates.length === 0) {
      const school = (await School.findById(schoolId)
        .select("curriculumCode")
        .lean()) as Pick<ISchool, "curriculumCode"> | null;

      const code = school?.curriculumCode || "ghana_nacca";
      const preset = getReportTemplatePreset(code);

      return NextResponse.json({
        success: true,
        data: [
          {
            _id: null,
            name: preset.name,
            curriculumCode: code,
            isDefault: true,
            isPreset: true,
            ...preset,
          },
        ],
      });
    }

    return NextResponse.json({ success: true, data: templates });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to list report templates:", e);
    return NextResponse.json(
      { success: false, error: "Failed to list report templates" },
      { status: 500 }
    );
  }
}

const SectionSchema = z.object({
  type: z.string(),
  label: z.string(),
  enabled: z.boolean(),
  order: z.number(),
  config: z.record(z.unknown()).optional(),
});

const CreateSchema = z.object({
  name: z.string().min(1),
  curriculumCode: z.string().optional(),
  isDefault: z.boolean().optional(),
  orientation: z.enum(["portrait", "landscape"]).optional(),
  paperSize: z.enum(["A4", "Letter"]).optional(),
  sections: z.array(SectionSchema).optional(),
  showClassPosition: z.boolean().optional(),
  showAttendance: z.boolean().optional(),
  showConduct: z.boolean().optional(),
  showGradingKey: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const school = (await School.findById(schoolId)
      .select("curriculumCode")
      .lean()) as Pick<ISchool, "curriculumCode"> | null;

    const curriculumCode =
      parsed.data.curriculumCode || school?.curriculumCode || "ghana_nacca";
    const preset = getReportTemplatePreset(
      curriculumCode as any
    );

    if (parsed.data.isDefault) {
      await ReportTemplate.updateMany(
        { schoolId, isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    const template = await ReportTemplate.create({
      schoolId,
      name: parsed.data.name,
      curriculumCode,
      isDefault: parsed.data.isDefault ?? false,
      orientation: parsed.data.orientation ?? preset.orientation,
      paperSize: parsed.data.paperSize ?? "A4",
      sections: parsed.data.sections ?? preset.sections,
      showClassPosition:
        parsed.data.showClassPosition ?? preset.showClassPosition,
      showAttendance: parsed.data.showAttendance ?? preset.showAttendance,
      showConduct: parsed.data.showConduct ?? preset.showConduct,
      showGradingKey: parsed.data.showGradingKey ?? preset.showGradingKey,
    });

    return NextResponse.json({ success: true, data: template });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to create report template:", e);
    return NextResponse.json(
      { success: false, error: "Failed to create report template" },
      { status: 500 }
    );
  }
}
