// src/app/api/admin/community/fundraising/[id]/export/route.ts
/**
 * Export campaign donations as CSV.
 */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { FundraisingCampaign, IFundraisingCampaign } from "@/models/FundraisingCampaign";
import { FundraisingDonation, IFundraisingDonation } from "@/models/FundraisingDonation";
import { recordActivity } from "@/lib/audit/recordActivity";
import { delegationAuditFields } from "@/lib/audit/delegationAuditFields";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function escapeCsv(value: string | null | undefined): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDate(value?: Date | string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

function formatDateTime(value?: Date | string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().replace("T", " ").substring(0, 19);
}

function formatAmount(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2);
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const authCtx = await requireSchoolAdminOrDelegatedAnyPermission([
      "fundraising.export",
    ]);
    const { userId, schoolId } = authCtx;
    await connectToDatabase();

    void FundraisingCampaign.modelName;
    void FundraisingDonation.modelName;

    const { id } = await context.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const campaignIdObj = new mongoose.Types.ObjectId(id);

    // Fetch campaign
    const campaign = await FundraisingCampaign.findOne({
      _id: campaignIdObj,
      schoolId: schoolIdObj,
    }).lean<IFundraisingCampaign>();

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Fetch all donations
    const donations = await FundraisingDonation.find({
      campaignId: campaignIdObj,
      schoolId: schoolIdObj,
    })
      .sort({ createdAt: -1 })
      .lean<IFundraisingDonation[]>();

    // Build CSV headers
    const headers = [
      "Donation ID",
      "Receipt Number",
      "Date",
      "Amount",
      "Currency",
      "Payment Method",
      "Status",
      "Is Anonymous",
      "Donor Name",
      "Donor Email",
      "Donor Phone",
      "Message",
    ];

    // Build CSV rows
    const rows: string[][] = [];
    for (const donation of donations) {
      const row: string[] = [
        String(donation._id),
        donation.receiptNumber || "",
        formatDateTime(donation.createdAt),
        formatAmount(donation.amountMinor),
        donation.currency,
        donation.paymentMethod,
        donation.status,
        donation.isAnonymous ? "Yes" : "No",
        donation.isAnonymous ? "Anonymous" : (donation.donorName || ""),
        donation.isAnonymous ? "" : (donation.donorEmail || ""),
        donation.isAnonymous ? "" : (donation.donorPhone || ""),
        donation.message || "",
      ];
      rows.push(row);
    }

    // Build CSV content
    const csvLines = [
      headers.map(escapeCsv).join(","),
      ...rows.map((row) => row.map(escapeCsv).join(",")),
    ];
    const csv = csvLines.join("\n");

    // Generate filename
    const campaignTitle = campaign.title.replace(/[^a-zA-Z0-9]/g, "-").substring(0, 50);
    const fileName = `campaign-donations-${campaignTitle}-${formatDate(new Date())}.csv`;

    // Record activity
    await recordActivity({
      schoolId: String(schoolId),
      userId: String(userId),
      type: "campaign.exported",
      entityType: "fundraising_campaign",
      entityId: String(campaignIdObj),
      description: `Exported campaign donations: ${campaign.title}`,
      ...delegationAuditFields({
        isDelegatedActor: !authCtx.isSchoolAdmin,
        activeDelegationId: authCtx.activeDelegationId,
        module: "fundraising",
        action: "campaign.exported",
      }),
      metadata: {
        campaignId: String(campaignIdObj),
        donationCount: donations.length,
        totalRaised: campaign.raisedAmountMinor,
        format: "csv",
      },
    });

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error exporting campaign donations:", error);
    return NextResponse.json({ error: "Failed to export campaign donations" }, { status: 500 });
  }
}
