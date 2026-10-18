import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { School } from "@/models/School";
import { AssessmentDefinitionVersion } from "@/models/AssessmentDefinitionVersion";
import { AssessmentDeliveryVersion } from "@/models/AssessmentDeliveryVersion";
import { AssessmentPaperPacket } from "@/models/AssessmentPaperPacket";
import { AssessmentPaperPacketAssignment } from "@/models/AssessmentPaperPacketAssignment";
import { AssessmentEvidencePage } from "@/models/AssessmentEvidencePage";
import { AssessmentMarkingEvaluation } from "@/models/AssessmentMarkingEvaluation";
import { AssessmentApprovedMarkingOutcome } from "@/models/AssessmentApprovedMarkingOutcome";
import { AssessmentScoreHandoffReceipt } from "@/models/AssessmentScoreHandoffReceipt";

function errorResponse(error: unknown) {
  if (error instanceof Response) return error;
  return Response.json(
    { success: false, error: "Unable to load the Assess overview" },
    { status: 500 },
  );
}

export async function GET() {
  try {
    const admin = await requireSchoolAdmin();
    const premium = await requireAssessPremiumPublication(admin.schoolId);
    if (!premium.allowed) {
      return Response.json(
        { success: false, error: premium.reason },
        { status: premium.statusCode },
      );
    }

    await connectToDatabase();

    const schoolId = admin.schoolId;
    const [
      school,
      publishedExaminations,
      issuedPaperPackets,
      candidateAssignments,
      evidenceRequiringAttention,
      markingAwaitingReview,
      approvedOutcomes,
      completedHandoffOutcomeIds,
      definitionsAwaitingPublication,
      recentDeliveries,
    ] = await Promise.all([
      School.findById(schoolId).select("name").lean<{ name?: string | null } | null>(),
      AssessmentDefinitionVersion.countDocuments({ schoolId, status: "published" }),
      AssessmentPaperPacket.countDocuments({ schoolId, status: "issued" }),
      AssessmentPaperPacketAssignment.countDocuments({ schoolId, status: "active" }),
      AssessmentEvidencePage.countDocuments({
        schoolId,
        status: { $ne: "deleted" },
        reconciliationOutcome: { $nin: ["valid"] },
      }),
      AssessmentMarkingEvaluation.countDocuments({ schoolId, status: "submitted" }),
      AssessmentApprovedMarkingOutcome.countDocuments({ schoolId, status: "current" }),
      AssessmentScoreHandoffReceipt.distinct("sourceOutcomeId", { schoolId, status: "completed" }),
      AssessmentDefinitionVersion.countDocuments({ schoolId, status: "review" }),
      AssessmentDeliveryVersion.find({ schoolId })
        .select("_id title status version resultBinding updatedAt")
        .sort({ updatedAt: -1 })
        .limit(6)
        .lean<Array<{ _id: unknown; title: string; status: string; version: number; resultBinding: string; updatedAt: Date }>>(),
    ]);

    const approvedAwaitingHandoff = Math.max(
      approvedOutcomes - completedHandoffOutcomeIds.length,
      0,
    );

    const attention = [
      definitionsAwaitingPublication > 0
        ? {
            id: "definitions-review",
            kind: "publication",
            title: "Examinations awaiting publication",
            detail: "Reviewed examination definitions are waiting for an authorized publication action.",
            count: definitionsAwaitingPublication,
            href: "/admin/examinations",
          }
        : null,
      evidenceRequiringAttention > 0
        ? {
            id: "evidence-attention",
            kind: "evidence",
            title: "Evidence requires attention",
            detail: "Captured pages are missing, unresolved or not yet verified.",
            count: evidenceRequiringAttention,
            href: "/admin/assessments/paper#evidence",
          }
        : null,
      markingAwaitingReview > 0
        ? {
            id: "marking-review",
            kind: "marking",
            title: "Marking awaiting review",
            detail: "Submitted evaluations need an independent moderation decision.",
            count: markingAwaitingReview,
            href: "/admin/assessments/paper#marking",
          }
        : null,
      approvedAwaitingHandoff > 0
        ? {
            id: "approved-handoff",
            kind: "results",
            title: "Approved results awaiting handoff",
            detail: "Approved Premium outcomes are ready for an explicit Core gradebook handoff.",
            count: approvedAwaitingHandoff,
            href: "/admin/assessments/paper#approved-results",
          }
        : null,
    ].filter((item): item is NonNullable<typeof item> => Boolean(item));

    return Response.json({
      success: true,
      data: {
        school: { id: String(schoolId), name: school?.name || "Current school" },
        metrics: {
          publishedExaminations,
          issuedPaperPackets,
          candidateAssignments,
          evidenceRequiringAttention,
          markingAwaitingReview,
          approvedAwaitingHandoff,
        },
        attention,
        recentExaminations: recentDeliveries.map((delivery) => ({
          id: String(delivery._id),
          title: delivery.title,
          status: delivery.status,
          version: delivery.version,
          resultBinding: delivery.resultBinding,
          updatedAt: delivery.updatedAt.toISOString(),
          href: `/admin/assessments/paper?delivery=${encodeURIComponent(String(delivery._id))}&focus=paper-delivery#paper-delivery`,
        })),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
