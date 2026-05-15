import type { IProposal } from "@/models/Proposal";
import type { IProposalBranding } from "@/models/ProposalBranding";

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

export function renderProposalHtml(proposal: IProposal | any, branding: IProposalBranding | any) {
  const enabledSections = (proposal.sections || [])
    .filter((section: any) => section.enabled)
    .sort((a: any, b: any) => a.order - b.order);
  const primary = branding.primaryColor || "#6D28D9";
  const secondary = branding.secondaryColor || "#06B6D4";
  const accent = branding.accentColor || "#0EA5E9";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(proposal.title)}</title>
  <style>
    @page { size: A4; margin: 16mm 14mm; }
    body { margin: 0; background: #ffffff; color: #102033; font-family: Inter, Arial, sans-serif; line-height: 1.55; }
    .cover { min-height: 920px; display: flex; flex-direction: column; justify-content: space-between; border-bottom: 4px solid ${primary}; padding-bottom: 28px; }
    .brand { color: ${primary}; font-weight: 800; font-size: 30px; letter-spacing: 0; }
    .tagline { color: #587084; font-size: 13px; margin-top: 4px; }
    .proposal-label { color: ${secondary}; text-transform: uppercase; font-size: 12px; letter-spacing: .16em; font-weight: 700; }
    h1 { font-size: 42px; line-height: 1.08; margin: 28px 0 14px; color: #101827; letter-spacing: 0; }
    h2 { font-size: 24px; margin: 0 0 12px; color: #101827; letter-spacing: 0; }
    p { margin: 0 0 12px; }
    .meta { display: grid; grid-template-columns: 150px 1fr; gap: 10px; color: #476176; font-size: 13px; }
    .section { page-break-inside: avoid; margin: 28px 0; padding: 22px; border: 1px solid #d9e3ec; border-radius: 18px; }
    .section.highlight { background: #f3f0ff; border-color: #d8ccff; }
    .section.callout { background: #ecfeff; border-color: #b9eef4; }
    .section.cards { background: #f8fafc; }
    .section-title { display: flex; align-items: center; gap: 10px; }
    .marker { width: 10px; height: 28px; border-radius: 999px; background: linear-gradient(180deg, ${primary}, ${accent}); }
    .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #d9e3ec; color: #64748b; font-size: 11px; display: flex; justify-content: space-between; }
    .page-break { page-break-before: always; }
  </style>
</head>
<body>
  <section class="cover">
    <div>
      <div class="brand">${escapeHtml(branding.brandName || "EduSentrix")}</div>
      <div class="tagline">${escapeHtml(branding.tagline || "Modern School Management Platform")}</div>
      <div style="margin-top: 140px;">
        <div class="proposal-label">Proposal</div>
        <h1>${escapeHtml(proposal.title)}</h1>
        <p style="max-width: 620px; color: #476176; font-size: 16px;">Prepared for ${escapeHtml(proposal.schoolName)}${proposal.schoolLocation ? `, ${escapeHtml(proposal.schoolLocation)}` : ""}.</p>
      </div>
    </div>
    <div class="meta">
      <strong>Prepared by</strong><span>${escapeHtml(proposal.preparedByName)}</span>
      <strong>Date</strong><span>${new Date().toLocaleDateString()}</span>
      <strong>Recipient</strong><span>${escapeHtml(proposal.recipientName || proposal.recipientTitle || "School leadership")}</span>
      <strong>Contact</strong><span>${escapeHtml(branding.contactEmail)} · ${escapeHtml(branding.whatsapp)}</span>
    </div>
  </section>

  ${enabledSections
    .map(
      (section: any) => `
        <section class="${section.pageBreakBefore ? "page-break " : ""}section ${escapeHtml(section.displayStyle)}">
          <div class="section-title"><span class="marker"></span><h2>${escapeHtml(section.title)}</h2></div>
          ${section.subtitle ? `<p style="color:#64748b;font-weight:600;">${escapeHtml(section.subtitle)}</p>` : ""}
          <div>${paragraphs(section.content)}</div>
        </section>
      `,
    )
    .join("")}

  <div class="footer">
    <span>${escapeHtml(branding.footerText || "EduSentrix - School management made simpler, clearer and smarter.")}</span>
    <span>${escapeHtml(branding.website)}</span>
  </div>
</body>
</html>`;
}
