/**
 * Server-side PDF generation for proposals using @react-pdf/renderer.
 *
 * Uses React.createElement explicitly (not JSX) so that Next.js App Router's
 * React-Server-Component JSX transform never interferes with the element tree
 * that @react-pdf/renderer's own reconciler processes.
 */
import React from "react";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { IProposal } from "@/models/Proposal";
import type { IProposalBranding } from "@/models/ProposalBranding";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/#{1,3}\s+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

const CONTACT_EMAIL_DEFAULT = "hello@tryedusentrix.app";
const OLD_CONTACT_EMAIL = "joseph.segbefia@tryedusentrix.app";

function resolveContactEmail(raw: string | null | undefined): string {
  if (!raw || raw.trim() === OLD_CONTACT_EMAIL) return CONTACT_EMAIL_DEFAULT;
  return raw.trim();
}

function metaDate(): string {
  return new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const PRIMARY = "#0891B2";
const DARK = "#0F172A";
const BODY = "#374151";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";

const S = StyleSheet.create({
  page: { fontFamily: "Helvetica", backgroundColor: "#FFFFFF", paddingBottom: 60 },
  stripe: { height: 5, backgroundColor: PRIMARY },

  letterhead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 44,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  // Logo mark shown as a square icon — all available logos are 1024×1024
  lhLogo: { width: 44, height: 44 },
  // Logo + wordmark row
  lhLogoRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  // "Edu" / "Sentrix" split — simulates the gradient blend the logo uses
  lhWordmark: { flexDirection: "row", alignItems: "baseline" },
  lhBrandEdu: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#0891B2" },
  lhBrandSentrix: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#38bdf8" },
  lhTagline: { fontSize: 7, color: "#94A3B8", marginTop: 4 },
  lhContact: { alignItems: "flex-end" },
  lhLine: { fontSize: 8, color: MUTED, marginTop: 2 },
  lhEmail: { fontSize: 8, color: PRIMARY, fontFamily: "Helvetica-Bold", marginTop: 2 },

  cover: {
    paddingHorizontal: 44,
    paddingTop: 48,
    paddingBottom: 40,
    flexGrow: 1,
    justifyContent: "space-between",
  },
  badge: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: PRIMARY,
    letterSpacing: 1.5,
    backgroundColor: "#E0F7FA",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 2,
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  coverTitle: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    lineHeight: 1.15,
    marginBottom: 14,
  },
  coverForRow: { flexDirection: "row", flexWrap: "wrap" },
  coverForText: { fontSize: 11, color: "#475569", lineHeight: 1.5 },
  coverForBold: { fontSize: 11, fontFamily: "Helvetica-Bold", color: DARK },
  divider: { width: 48, height: 3, backgroundColor: PRIMARY, marginTop: 24, marginBottom: 28, borderRadius: 2 },

  metaRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: BORDER, paddingVertical: 8 },
  metaLabel: { width: 110, fontSize: 7, fontFamily: "Helvetica-Bold", color: "#94A3B8", letterSpacing: 0.8 },
  metaValue: { flex: 1, fontSize: 9, color: DARK, fontFamily: "Helvetica-Bold" },

  contentPage: { paddingHorizontal: 44, paddingTop: 36, paddingBottom: 60 },
  secNumRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  secCircle: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center", marginRight: 8,
  },
  secCircleText: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  secNumLabel: { fontSize: 7, color: "#94A3B8", fontFamily: "Helvetica-Bold", letterSpacing: 0.8 },
  secTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 4, lineHeight: 1.25 },
  secSubtitle: { fontSize: 9.5, color: MUTED, marginBottom: 10 },
  secPara: { fontSize: 10, color: BODY, lineHeight: 1.6, marginBottom: 8 },

  footer: {
    position: "absolute", bottom: 20, left: 44, right: 44,
    borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 8,
    flexDirection: "row", justifyContent: "space-between",
  },
  footerBrand: { fontSize: 7, color: MUTED, fontFamily: "Helvetica-Bold" },
  footerSub: { fontSize: 7, color: "#94A3B8" },
  footerUrl: { fontSize: 7, color: PRIMARY, fontFamily: "Helvetica-Bold" },
});

// ---------------------------------------------------------------------------
// Element factory — uses React.createElement directly.
// This is intentional: JSX in this file would go through Next.js's automated
// JSX transform (react/jsx-runtime), which adds RSC metadata that
// @react-pdf/renderer's reconciler does not understand.
// ---------------------------------------------------------------------------

function e(type: any, props?: any, ...children: any[]): React.ReactElement {
  return React.createElement(type, props, ...children.flat().filter(Boolean));
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function stripe() {
  return e(View, { style: S.stripe });
}

function letterhead(
  logoDataUri: string | null | undefined,
  brandName: string,
  tagline: string,
  website: string,
  contactEmail: string,
  address: string | null,
) {
  // Split at the second capital letter (e.g. "Edu" | "Sentrix") to simulate
  // the logo's colour gradient. @react-pdf/renderer doesn't support CSS
  // gradient text, so each segment gets its own colour.
  const splitIdx = brandName.search(/[A-Z]/, 1); // second capital letter
  const splitAt = splitIdx > 0 ? splitIdx : Math.ceil(brandName.length / 2);
  const part1 = brandName.slice(0, splitAt);
  const part2 = brandName.slice(splitAt);

  return e(View, { style: S.letterhead },
    e(View, {},
      e(View, { style: S.lhLogoRow },
        logoDataUri
          ? e(Image, { src: logoDataUri, style: S.lhLogo })
          : null,
        e(View, { style: S.lhWordmark },
          e(Text, { style: S.lhBrandEdu }, part1),
          e(Text, { style: S.lhBrandSentrix }, part2),
        ),
      ),
      e(Text, { style: S.lhTagline }, tagline),
    ),
    e(View, { style: S.lhContact },
      e(Text, { style: S.lhLine }, website),
      e(Text, { style: S.lhEmail }, contactEmail),
      address ? e(Text, { style: S.lhLine }, address) : null,
    ),
  );
}

function pageFooter(footerText: string, website: string) {
  return e(View, { style: S.footer, fixed: true },
    e(View, {},
      e(Text, { style: S.footerBrand }, footerText),
      e(Text, { style: S.footerSub }, "Confidential — prepared for the named recipient only"),
    ),
    e(Text, { style: S.footerUrl }, website),
  );
}

function metaRow(label: string, value: string) {
  return e(View, { style: S.metaRow },
    e(Text, { style: S.metaLabel }, label.toUpperCase()),
    e(Text, { style: S.metaValue }, value),
  );
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

/**
 * Renders the proposal as a real PDF Buffer.
 * Suitable for email attachment, download, or archiving.
 */
export async function renderProposalPdf(
  proposal: IProposal | any,
  branding: IProposalBranding | any,
  logoDataUri?: string | null,
): Promise<Buffer> {
  const b = branding ?? {};
  const contactEmail = resolveContactEmail(b.contactEmail);
  const website: string = b.website || "www.tryedusentrix.app";
  const tagline: string = b.tagline || "Modern School Management Platform";
  const footerText: string =
    b.footerText || "EduSentrix — School management made simpler, clearer and smarter.";
  const address: string | null = b.address || null;

  const enabledSections = ((proposal.sections || []) as any[])
    .filter((s: any) => s.enabled && stripHtml(s.content).length > 0)
    .sort((a: any, bx: any) => a.order - bx.order);

  const recipientDisplay = [proposal.recipientTitle, proposal.recipientName]
    .filter(Boolean)
    .join(" ");

  const lh = letterhead(logoDataUri, b.brandName || "EduSentrix", tagline, website, contactEmail, address);
  const footer = pageFooter(footerText, website);

  // Cover page
  const coverPage = e(Page, { size: "A4", style: S.page },
    stripe(),
    lh,
    e(View, { style: S.cover },
      e(View, {},
        e(Text, { style: S.badge }, "PROPOSAL"),
        e(Text, { style: S.coverTitle }, proposal.title),
        e(View, { style: S.coverForRow },
          e(Text, { style: S.coverForText }, "Prepared exclusively for "),
          e(Text, { style: S.coverForBold }, proposal.schoolName),
          proposal.schoolLocation
            ? e(Text, { style: S.coverForText }, `, ${String(proposal.schoolLocation)}.`)
            : e(Text, { style: S.coverForText }, "."),
        ),
        e(View, { style: S.divider }),
      ),
      e(View, {},
        metaRow("Prepared by", String(proposal.preparedByName || "EduSentrix Team")),
        metaRow("Date", metaDate()),
        recipientDisplay ? metaRow("Prepared for", recipientDisplay) : null,
        proposal.recipientEmail ? metaRow("Contact", String(proposal.recipientEmail)) : null,
        metaRow("Enquiries", contactEmail),
      ),
    ),
    footer,
  );

  // One page per content section
  const sectionPages = enabledSections.map((section: any, index: number) => {
    const paragraphs = splitParagraphs(stripHtml(section.content));
    return e(Page, { key: String(index), size: "A4", style: S.page },
      stripe(),
      lh,
      e(View, { style: S.contentPage },
        e(View, { style: S.secNumRow },
          e(View, { style: S.secCircle },
            e(Text, { style: S.secCircleText }, String(index + 1)),
          ),
          e(Text, { style: S.secNumLabel }, `SECTION ${String(index + 1).padStart(2, "0")}`),
        ),
        e(Text, { style: S.secTitle }, String(section.title)),
        section.subtitle ? e(Text, { style: S.secSubtitle }, String(section.subtitle)) : null,
        ...paragraphs.map((para: string, pi: number) =>
          e(Text, { key: `p${pi}`, style: S.secPara }, para),
        ),
      ),
      footer,
    );
  });

  const doc = e(Document,
    {
      title: String(proposal.title),
      author: String(proposal.preparedByName || "EduSentrix"),
      subject: `Proposal for ${String(proposal.schoolName)}`,
      creator: "EduSentrix Platform",
    },
    coverPage,
    ...sectionPages,
  );

  const result = await renderToBuffer(doc);
  // renderToBuffer may return a Uint8Array — ensure it's a Node.js Buffer
  return Buffer.isBuffer(result) ? result : Buffer.from(result);
}
