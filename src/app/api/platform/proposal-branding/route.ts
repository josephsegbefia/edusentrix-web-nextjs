import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { ensureDefaultProposalData } from "@/lib/proposals/utils";
import { ProposalBranding } from "@/models/ProposalBranding";

const BrandingSchema = z.object({
  brandName: z.string().trim().min(1).max(100).optional(),
  tagline: z.string().trim().max(160).optional().nullable(),
  logoUrl: z.string().trim().max(500).optional().nullable(),
  letterheadLogoUrl: z.string().trim().max(500).optional().nullable(),
  primaryColor: z.string().trim().max(20).optional(),
  secondaryColor: z.string().trim().max(20).optional(),
  accentColor: z.string().trim().max(20).optional().nullable(),
  website: z.string().trim().max(200).optional(),
  contactEmail: z.string().trim().email().optional(),
  whatsapp: z.string().trim().max(40).optional(),
  address: z.string().trim().max(240).optional().nullable(),
  footerText: z.string().trim().max(240).optional().nullable(),
  letterheadEnabled: z.boolean().optional(),
  watermarkEnabled: z.boolean().optional(),
});

function serializeBranding(doc: any) {
  return {
    id: String(doc._id),
    brandName: doc.brandName,
    tagline: doc.tagline || "",
    logoUrl: doc.logoUrl || "",
    letterheadLogoUrl: doc.letterheadLogoUrl || "",
    primaryColor: doc.primaryColor,
    secondaryColor: doc.secondaryColor,
    accentColor: doc.accentColor || "",
    website: doc.website,
    contactEmail: doc.contactEmail,
    whatsapp: doc.whatsapp,
    address: doc.address || "",
    footerText: doc.footerText || "",
    letterheadEnabled: Boolean(doc.letterheadEnabled),
    watermarkEnabled: Boolean(doc.watermarkEnabled),
  };
}

export async function GET() {
  try {
    const gate = await requirePlatformPermission("platform.proposals.read");
    if (!gate.ok) return gate.res;
    await connectToDatabase();
    const { branding } = await ensureDefaultProposalData(gate.actor.userId);
    return NextResponse.json({ success: true, data: serializeBranding(branding) });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load proposal branding" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const gate = await requirePlatformPermission("platform.proposals.manageBranding");
    if (!gate.ok) return gate.res;
    await connectToDatabase();
    await ensureDefaultProposalData(gate.actor.userId);

    const parsed = BrandingSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const branding = await ProposalBranding.findOneAndUpdate({}, { $set: parsed.data }, { new: true });
    return NextResponse.json({ success: true, data: serializeBranding(branding) });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update proposal branding" },
      { status: 500 },
    );
  }
}
