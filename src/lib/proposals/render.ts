import type { IProposal } from "@/models/Proposal";
import type { IProposalBranding } from "@/models/ProposalBranding";
import { sanitizeProposalHtml } from "@/lib/proposals/utils";

const CONTACT_EMAIL_DEFAULT = "hello@tryedusentrix.app";
const OLD_CONTACT_EMAIL = "joseph.segbefia@tryedusentrix.app";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

/**
 * Normalise AI-generated or manually entered content into clean HTML.
 * TipTap stores content as HTML but Leo sometimes places raw Markdown syntax
 * (e.g. "### Heading", "**bold**") inside <p> tags. This cleans those up so
 * they render properly in the generated document.
 */
function renderSectionContent(content: string) {
  const value = String(content || "");

  let html: string;
  if (/<[a-z][\s\S]*>/i.test(value)) {
    html = sanitizeProposalHtml(value);
  } else {
    // Plain text — wrap each double-newline-separated block in a paragraph.
    html = escapeHtml(value)
      .split(/\n{2,}/)
      .map((p) => `<p>${p.trim().replaceAll("\n", "<br />")}</p>`)
      .join("");
  }

  // Convert lingering Markdown artifacts that may survive inside HTML tags.
  return html
    // ### Heading or ## Heading inside a <p>
    .replace(/<p>#{3,}\s+(.+?)<\/p>/g, "<h3>$1</h3>")
    .replace(/<p>#{2}\s+(.+?)<\/p>/g, "<h3>$1</h3>")
    // **bold** or __bold__
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    // *italic* or _italic_
    .replace(/\*([^*\n]+?)\*/g, "<em>$1</em>")
    .replace(/_([^_\n]+?)_/g, "<em>$1</em>");
}

function resolveContactEmail(raw: string | null | undefined): string {
  if (!raw || raw.trim() === OLD_CONTACT_EMAIL) return CONTACT_EMAIL_DEFAULT;
  return raw.trim();
}

/**
 * Renders the proposal as a self-contained A4 HTML document.
 * @param logoDataUri  Optional base64 data URI for the EduSentrix logo.
 *                     When omitted the letterhead falls back to the brand name text.
 */
export function renderProposalHtml(
  proposal: IProposal | any,
  branding: IProposalBranding | any,
  logoDataUri?: string | null,
) {
  const b = branding ?? {};
  const primary = b.primaryColor || "#0891B2";
  const secondary = b.secondaryColor || "#06B6D4";
  const contactEmail = resolveContactEmail(b.contactEmail);
  const website = b.website || "www.tryedusentrix.app";
  const tagline = b.tagline || "Modern School Management Platform";
  const footerText = b.footerText || "EduSentrix — School management made simpler, clearer and smarter.";
  const address = b.address || "";

  const enabledSections = (proposal.sections || [])
    .filter((s: any) => s.enabled && plainText(s.content).length > 0)
    .sort((a: any, b2: any) => a.order - b2.order);

  const metaDate = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const recipientDisplay = [proposal.recipientTitle, proposal.recipientName].filter(Boolean).join(" ");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(proposal.title)}</title>
  <style>
    @page { size: A4; margin: 0; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #fff;
      color: #1e293b;
      font-family: "Helvetica Neue", Arial, Helvetica, sans-serif;
      font-size: 11pt;
      line-height: 1.65;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── Top accent stripe ── */
    .stripe {
      height: 5px;
      background: linear-gradient(90deg, ${primary} 0%, ${secondary} 60%, #38bdf8 100%);
    }

    /* ── Letterhead ── */
    .letterhead {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 32px;
      padding: 24px 44px 22px;
      border-bottom: 1px solid #e2e8f0;
      background: #fff;
    }
    .lh-brand { display: flex; align-items: center; gap: 14px; }
    /* Square logo mark — all available logos are 1024×1024 */
    .lh-logo { height: 44px; width: 44px; display: block; object-fit: contain; }
    .lh-brand-text {
      font-size: 20pt;
      font-weight: 900;
      letter-spacing: -0.02em;
      line-height: 1;
      background: linear-gradient(90deg, #7B16FF 0%, #1E66FF 48%, #00E5FF 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .lh-tagline { font-size: 8pt; color: #94a3b8; margin-top: 4px; letter-spacing: 0.02em; }
    .lh-contact {
      text-align: right;
      font-size: 9pt;
      color: #64748b;
      line-height: 1.7;
      padding-top: 2px;
    }
    .lh-contact .email { color: ${primary}; font-weight: 600; }

    /* ── Cover page ── */
    .cover {
      min-height: 760px;
      padding: 52px 44px 44px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: #fff;
    }
    .proposal-badge {
      display: inline-block;
      background: #e0f7fa;
      color: ${primary};
      font-size: 7.5pt;
      font-weight: 800;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      padding: 5px 13px;
      border-radius: 3px;
      margin-bottom: 28px;
    }
    .cover-title {
      font-size: 30pt;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.1;
      letter-spacing: -0.02em;
      margin-bottom: 16px;
    }
    .cover-prepared-for {
      font-size: 12.5pt;
      color: #475569;
      max-width: 580px;
      line-height: 1.5;
    }
    .cover-prepared-for strong { color: #0f172a; }
    .cover-divider {
      width: 56px;
      height: 3px;
      background: ${primary};
      margin: 28px 0 32px;
      border-radius: 2px;
    }

    /* ── Meta table (cover footer) ── */
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      border-top: 1px solid #e2e8f0;
    }
    .meta-table tr { border-bottom: 1px solid #f1f5f9; }
    .meta-table td {
      padding: 10px 0;
      font-size: 9.5pt;
      vertical-align: top;
    }
    .meta-table .label {
      width: 130px;
      color: #94a3b8;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-weight: 700;
      padding-top: 12px;
    }
    .meta-table .value { color: #1e293b; font-weight: 500; }

    /* ── Content area ── */
    .content { padding: 8px 44px 44px; }

    /* ── Sections ── */
    .section {
      margin-top: 36px;
      page-break-inside: avoid;
    }
    .section.page-break { page-break-before: always; margin-top: 0; padding-top: 36px; }
    .section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .section-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      background: ${primary};
      color: #fff;
      font-size: 8pt;
      font-weight: 800;
      border-radius: 50%;
      flex-shrink: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .section-num-label {
      font-size: 7.5pt;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-weight: 700;
    }
    .section h2 {
      font-size: 14pt;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 6px;
      line-height: 1.25;
    }
    .section-subtitle {
      font-size: 10pt;
      color: #64748b;
      font-weight: 500;
      margin-bottom: 12px;
    }
    .section-body { font-size: 10.5pt; color: #374151; }
    .section-body p { margin-bottom: 10px; }
    .section-body ul, .section-body ol {
      padding-left: 20px;
      margin-bottom: 12px;
    }
    .section-body li { margin-bottom: 5px; }
    .section-body strong { color: #1e293b; }
    .section-body a { color: ${primary}; }
    .section-body h3 { font-size: 11.5pt; font-weight: 700; color: #1e293b; margin: 12px 0 6px; }
    .section-body blockquote {
      margin: 6px 0 12px;
      padding: 8px 14px;
      border-left: 3px solid ${secondary};
      color: #475569;
      background: #f8fafc;
    }
    .section-body table { border-collapse: collapse; width: 100%; margin-bottom: 12px; }
    .section-body th {
      background: #f1f5f9;
      color: #1e293b;
      font-weight: 700;
      padding: 7px 10px;
      text-align: left;
      font-size: 9pt;
      border: 1px solid #e2e8f0;
    }
    .section-body td {
      padding: 7px 10px;
      border: 1px solid #e2e8f0;
      font-size: 10pt;
      color: #374151;
    }

    /* Section style variants */
    .section.highlight .section-body {
      border-left: 3px solid ${primary};
      padding: 12px 16px;
      background: #f0fdfe;
      border-radius: 0 4px 4px 0;
    }
    .section.callout .section-body {
      border: 1px solid #bae6fd;
      background: #f0f9ff;
      padding: 14px 18px;
      border-radius: 4px;
    }
    .section.cards .section-body {
      border: 1px solid #e2e8f0;
      padding: 14px 18px;
      border-radius: 6px;
      background: #fafafa;
    }
    .section.table .section-body { }

    /* ── Footer ── */
    .doc-footer {
      margin: 40px 44px 32px;
      padding-top: 14px;
      border-top: 1.5px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      font-size: 8pt;
      color: #94a3b8;
      gap: 24px;
    }
    .doc-footer .footer-brand { font-weight: 600; color: #64748b; }
    .doc-footer .footer-url { color: ${primary}; font-weight: 600; }
    .doc-footer .confidential {
      font-size: 7pt;
      color: #c4cdd9;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    /* ── Print media ── */
    @media print {
      @page { size: A4; margin: 0; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .stripe { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .section-num { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .cover { min-height: 0; page-break-after: always; }
      .section { page-break-inside: avoid; }
      .section.page-break { page-break-before: always; }
    }
  </style>
</head>
<body>

  <!-- Top stripe -->
  <div class="stripe"></div>

  <!-- Letterhead -->
  <div class="letterhead">
    <div>
      <div class="lh-brand">
        ${logoDataUri ? `<img class="lh-logo" src="${logoDataUri}" alt="EduSentrix" />` : ""}
        <span class="lh-brand-text">${escapeHtml(b.brandName || "EduSentrix")}</span>
      </div>
      <div class="lh-tagline">${escapeHtml(tagline)}</div>
    </div>
    <div class="lh-contact">
      <div>${escapeHtml(website)}</div>
      <div class="email">${escapeHtml(contactEmail)}</div>
      ${address ? `<div>${escapeHtml(address)}</div>` : ""}
    </div>
  </div>

  <!-- Cover page -->
  <section class="cover">
    <div>
      <span class="proposal-badge">Proposal</span>
      <div class="cover-title">${escapeHtml(proposal.title)}</div>
      <p class="cover-prepared-for">
        Prepared exclusively for <strong>${escapeHtml(proposal.schoolName)}</strong>${proposal.schoolLocation ? `, ${escapeHtml(proposal.schoolLocation)}` : ""}.
      </p>
      <div class="cover-divider"></div>
    </div>
    <table class="meta-table">
      <tr>
        <td class="label">Prepared by</td>
        <td class="value">${escapeHtml(proposal.preparedByName || "EduSentrix Team")}</td>
      </tr>
      <tr>
        <td class="label">Date</td>
        <td class="value">${metaDate}</td>
      </tr>
      ${recipientDisplay ? `<tr><td class="label">Prepared for</td><td class="value">${escapeHtml(recipientDisplay)}</td></tr>` : ""}
      ${proposal.recipientEmail ? `<tr><td class="label">Contact</td><td class="value">${escapeHtml(proposal.recipientEmail)}</td></tr>` : ""}
      <tr>
        <td class="label">Enquiries</td>
        <td class="value">${escapeHtml(contactEmail)}</td>
      </tr>
    </table>
  </section>

  <!-- Body sections -->
  <div class="content">
    ${enabledSections
      .map(
        (section: any, index: number) => `
      <div class="${section.pageBreakBefore ? "page-break " : ""}section ${escapeHtml(section.displayStyle || "standard")}">
        <div class="section-header">
          <span class="section-num">${String(index + 1)}</span>
          <span class="section-num-label">Section ${String(index + 1).padStart(2, "0")}</span>
        </div>
        <h2>${escapeHtml(section.title)}</h2>
        ${section.subtitle ? `<div class="section-subtitle">${escapeHtml(section.subtitle)}</div>` : ""}
        <div class="section-body">${renderSectionContent(section.content)}</div>
      </div>
    `,
      )
      .join("")}
  </div>

  <!-- Footer -->
  <div class="doc-footer">
    <div>
      <div class="footer-brand">${escapeHtml(footerText)}</div>
      <div class="confidential">Confidential — prepared for the named recipient only</div>
    </div>
    <div class="footer-url">${escapeHtml(website)}</div>
  </div>

</body>
</html>`;
}
