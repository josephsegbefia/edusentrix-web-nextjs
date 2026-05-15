import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Proposal } from "@/models/Proposal";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ proposalId: string }> },
) {
  const gate = await requirePlatformPermission("platform.proposals.generatePdf");
  if (!gate.ok) return gate.res;
  await connectToDatabase();
  const { proposalId } = await ctx.params;
  if (!mongoose.Types.ObjectId.isValid(proposalId)) {
    return NextResponse.json({ success: false, error: "Invalid proposal id" }, { status: 400 });
  }
  const proposal = await Proposal.findById(proposalId).select("pdfDataBase64 pdfFileName");
  if (!proposal?.pdfDataBase64) {
    return NextResponse.json({ success: false, error: "Generate the proposal file first" }, { status: 404 });
  }
  const buffer = Buffer.from(proposal.pdfDataBase64, "base64");
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${proposal.pdfFileName || "proposal.html"}"`,
    },
  });
}
