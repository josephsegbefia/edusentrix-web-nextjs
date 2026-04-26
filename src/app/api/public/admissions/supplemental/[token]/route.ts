// GET — metadata for the branded supplemental upload page (token from email).

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionApplication } from "@/models/AdmissionApplication";
import { AdmissionCycle } from "@/models/AdmissionCycle";
import { School } from "@/models/School";

type Params = Promise<{ token: string }>;

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  try {
    const { token } = await params;
    if (!token || token.length < 24) {
      return NextResponse.json(
        { success: false, error: "Invalid link" },
        { status: 404 }
      );
    }

    await connectToDatabase();

    const application = await AdmissionApplication.findOne({
      supplementalDocumentRequests: {
        $elemMatch: { token, fulfilledAt: null },
      },
    })
      .select({
        referenceCode: 1,
        schoolId: 1,
        cycleId: 1,
        status: 1,
        supplementalDocumentRequests: 1,
      })
      .lean();

    if (!application) {
      return NextResponse.json(
        { success: false, error: "This upload link is invalid or already used." },
        { status: 404 }
      );
    }

    if (
      application.status === "accepted" ||
      application.status === "rejected" ||
      application.status === "withdrawn" ||
      application.status === "expired"
    ) {
      return NextResponse.json(
        { success: false, error: "This application is closed for uploads." },
        { status: 409 }
      );
    }

    const sub = (application.supplementalDocumentRequests ?? []).find(
      (r) => r.token === token && !r.fulfilledAt
    );
    if (!sub) {
      return NextResponse.json(
        { success: false, error: "This upload link is invalid or already used." },
        { status: 404 }
      );
    }

    const [school, cycle] = await Promise.all([
      School.findById(application.schoolId).select("name logo").lean<{
        name?: string;
        logo?: string | null;
      } | null>(),
      AdmissionCycle.findById(application.cycleId).select("name").lean<{
        name?: string;
      } | null>(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        referenceCode: application.referenceCode,
        schoolName: school?.name ?? "School",
        schoolLogoUrl: school?.logo ?? null,
        cycleName: cycle?.name ?? "Admissions",
        documentLabel: sub.label,
        message: sub.message ?? null,
      },
    });
  } catch (error) {
    console.error("Public supplemental GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load upload page" },
      { status: 500 }
    );
  }
}
