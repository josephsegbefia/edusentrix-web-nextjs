// src/app/api/admin/community/polls/templates/seed/route.ts
/**
 * Seed platform-wide poll templates.
 * These templates are available to all schools.
 * Only school admins can trigger this, and it's idempotent (safe to run multiple times).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PollTemplate } from "@/models/PollTemplate";
import { POLL_TEMPLATES } from "@/constants/poll-templates";

export async function POST(_req: NextRequest) {
  try {
    await requireSchoolAdmin();
    await connectToDatabase();

    let created = 0;
    let skipped = 0;

    // Seed platform-wide templates (schoolId = null)
    for (const template of POLL_TEMPLATES) {
      // Check if template already exists (by name, for platform templates)
      const existing = await PollTemplate.findOne({
        schoolId: null,
        name: template.name,
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Create the template
      await PollTemplate.create({
        schoolId: null, // Platform-wide
        name: template.name,
        description: template.description,
        category: template.category,
        icon: template.icon,
        color: template.color,
        questions: template.questions,
        defaults: template.defaults,
        isActive: true,
        isPlatformDefault: true,
        usageCount: 0,
        createdBy: null,
      });

      created++;
    }

    return NextResponse.json({
      success: true,
      message: `Seeded ${created} templates, skipped ${skipped} existing templates`,
      created,
      skipped,
      total: POLL_TEMPLATES.length,
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error seeding poll templates:", error);
    const message = error instanceof Error ? error.message : "Failed to seed templates";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
