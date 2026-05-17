import type { IProposal } from "@/models/Proposal";
import type { IProposalBranding } from "@/models/ProposalBranding";
import { sanitizeProposalHtml } from "@/lib/proposals/utils";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function paragraphs(content: string) {
  return escapeHtml(content)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.trim().replaceAll("\n", "<br />")}</p>`)
    .join("");
}

function plainText(content: string) {
  return String(content || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function renderSectionContent(content: string) {
  const value = String(content || "");
  if (/<[a-z][\s\S]*>/i.test(value)) {
    return sanitizeProposalHtml(value);
  }
  return paragraphs(value);
}

export function renderProposalHtml(proposal: IProposal | any, branding: IProposalBranding | any) {
  const enabledSections = (proposal.sections || [])
    .filter((section: any) => section.enabled && plainText(section.content).length > 0)
    .sort((a: any, b: any) => a.order - b.order);
  const primary = branding.primaryColor || "#6D28D9";
  const secondary = branding.secondaryColor || "#06B6D4";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(proposal.title)}</title>
  <style>
    @page { size: A4; margin: 18mm 17mm 18mm 17mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #ffffff; color: #172033; font-family: Georgia, "Times New Roman", serif; line-height: 1.62; font-size: 12.5pt; }
    .document { max-width: 820px; margin: 0 auto; }
    .letterhead { display: flex; align-items: flex-start; justify-content: space-between; gap: 32px; padding-bottom: 18px; border-bottom: 1.5px solid #1f2a44; }
    .brand { color: #111827; font-family: Arial, sans-serif; font-weight: 800; font-size: 24px; letter-spacing: 0; }
    .tagline { color: #506174; font-family: Arial, sans-serif; font-size: 11px; margin-top: 3px; }
    .contact { text-align: right; color: #506174; font-family: Arial, sans-serif; font-size: 10.5px; line-height: 1.5; }
    .cover { min-height: 860px; display: flex; flex-direction: column; justify-content: space-between; padding-top: 8px; }
    .proposal-label { color: ${primary}; text-transform: uppercase; font-family: Arial, sans-serif; font-size: 11px; letter-spacing: .18em; font-weight: 700; }
    h1 { font-family: Arial, sans-serif; font-size: 34px; line-height: 1.16; margin: 26px 0 12px; color: #111827; letter-spacing: 0; font-weight: 760; }
    h2 { font-family: Arial, sans-serif; font-size: 18px; margin: 0 0 9px; color: #111827; letter-spacing: 0; font-weight: 740; }
    p { margin: 0 0 11px; }
    ul, ol { margin: 0 0 12px 22px; padding: 0; }
    li { margin: 0 0 5px; }
    blockquote { margin: 0 0 12px; padding: 8px 14px; border-left: 3px solid ${secondary}; color: #475569; background: #f8fafc; }
    strong { color: #111827; }
    a { color: ${primary}; }
    .prepared-for { max-width: 620px; color: #374151; font-size: 14.5px; font-family: Arial, sans-serif; }
    .meta { width: 100%; border-collapse: collapse; color: #334155; font-family: Arial, sans-serif; font-size: 11.5px; }
    .meta td { border-top: 1px solid #e2e8f0; padding: 9px 0; vertical-align: top; }
    .meta td:first-child { width: 150px; color: #64748b; text-transform: uppercase; letter-spacing: .08em; font-size: 9.5px; font-weight: 700; }
    .section { page-break-inside: avoid; margin: 24px 0; padding-top: 18px; border-top: 1px solid #d7dee8; }
    .section.highlight, .section.callout, .section.cards { padding: 18px 20px; border: 1px solid #d7dee8; background: #fbfdff; }
    .section.highlight { border-left: 4px solid ${primary}; }
    .section.callout { border-left: 4px solid ${secondary}; }
    .section-title { display: block; }
    .marker { display: none; }
    .section-number { display: inline-block; margin-bottom: 7px; color: ${primary}; font-family: Arial, sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
    .footer { margin-top: 38px; padding-top: 12px; border-top: 1px solid #d9e3ec; color: #64748b; font-family: Arial, sans-serif; font-size: 10px; display: flex; justify-content: space-between; gap: 24px; }
    .page-break { page-break-before: always; }
  </style>
</head>
<body>
  <main class="document">
  <section class="cover">
    <div>
      <div class="letterhead">
        <div>
          <div class="brand">${escapeHtml(branding.brandName || "EduSentrix")}</div>
          <div class="tagline">${escapeHtml(branding.tagline || "Modern School Management Platform")}</div>
        </div>
        <div class="contact">
          ${escapeHtml(branding.website)}<br />
          ${escapeHtml(branding.contactEmail)}<br />
          ${escapeHtml(branding.whatsapp)}
        </div>
      </div>
      <div style="margin-top: 132px;">
        <div class="proposal-label">Proposal</div>
        <h1>${escapeHtml(proposal.title)}</h1>
        <p class="prepared-for">Prepared for ${escapeHtml(proposal.schoolName)}${proposal.schoolLocation ? `, ${escapeHtml(proposal.schoolLocation)}` : ""}.</p>
      </div>
    </div>
    <table class="meta">
      <tr><td>Prepared by</td><td>${escapeHtml(proposal.preparedByName)}</td></tr>
      <tr><td>Date</td><td>${new Date().toLocaleDateString()}</td></tr>
      <tr><td>Recipient</td><td>${escapeHtml(proposal.recipientName || proposal.recipientTitle || "School leadership")}</td></tr>
      <tr><td>Contact</td><td>${escapeHtml(branding.contactEmail)} · ${escapeHtml(branding.whatsapp)}</td></tr>
    </table>
  </section>

  ${enabledSections
    .map(
      (section: any, index: number) => `
        <section class="${section.pageBreakBefore ? "page-break " : ""}section ${escapeHtml(section.displayStyle)}">
          <span class="section-number">Section ${String(index + 1).padStart(2, "0")}</span>
          <div class="section-title"><h2>${escapeHtml(section.title)}</h2></div>
          ${section.subtitle ? `<p style="color:#64748b;font-weight:600;">${escapeHtml(section.subtitle)}</p>` : ""}
          <div>${renderSectionContent(section.content)}</div>
        </section>
      `,
    )
    .join("")}

  <div class="footer">
    <span>${escapeHtml(branding.footerText || "EduSentrix - School management made simpler, clearer and smarter.")}</span>
    <span>${escapeHtml(branding.website)}</span>
  </div>
  </main>
</body>
</html>`;
}
