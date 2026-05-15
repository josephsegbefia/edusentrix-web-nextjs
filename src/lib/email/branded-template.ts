import "server-only";
import { EDUSENTRIX_LOGO_ALT, EDUSENTRIX_LOGO_PATH } from "@/lib/branding";
import { getAppUrl } from "@/lib/utils/getAppUrl";

const BRAND_MARKER = "edusentrix-branded-email";
const APP_URL = getAppUrl();
const EDUSENTRIX_LOGO_URL = `${APP_URL}${EDUSENTRIX_LOGO_PATH}`;

type EmailTone = "default" | "success" | "warning" | "danger" | "billing";

type BrandedEmailArgs = {
  title: string;
  preheader?: string;
  eyebrow?: string;
  bodyHtml: string;
  brand?: {
    name?: string | null;
    logoUrl?: string | null;
  };
  cta?: {
    label: string;
    href: string;
  };
  footerNote?: string;
  tone?: EmailTone;
};

const toneColors: Record<
  EmailTone,
  {
    accent: string;
    soft: string;
    header: string;
    headerBorder: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  default: {
    accent: "#2563eb",
    soft: "#eff6ff",
    header: "linear-gradient(135deg,#e0f2fe 0%,#f8fafc 52%,#eef2ff 100%)",
    headerBorder: "#bfdbfe",
    badgeBg: "#dbeafe",
    badgeText: "#1d4ed8",
  },
  success: {
    accent: "#059669",
    soft: "#ecfdf5",
    header: "linear-gradient(135deg,#d1fae5 0%,#f8fafc 56%,#ecfdf5 100%)",
    headerBorder: "#a7f3d0",
    badgeBg: "#d1fae5",
    badgeText: "#047857",
  },
  warning: {
    accent: "#d97706",
    soft: "#fffbeb",
    header: "linear-gradient(135deg,#fef3c7 0%,#f8fafc 56%,#fff7ed 100%)",
    headerBorder: "#fde68a",
    badgeBg: "#fef3c7",
    badgeText: "#b45309",
  },
  danger: {
    accent: "#e11d48",
    soft: "#fff1f2",
    header: "linear-gradient(135deg,#ffe4e6 0%,#f8fafc 56%,#fff1f2 100%)",
    headerBorder: "#fecdd3",
    badgeBg: "#ffe4e6",
    badgeText: "#be123c",
  },
  billing: {
    accent: "#0891b2",
    soft: "#ecfeff",
    header: "linear-gradient(135deg,#cffafe 0%,#f8fafc 54%,#e0f2fe 100%)",
    headerBorder: "#a5f3fc",
    badgeBg: "#cffafe",
    badgeText: "#0e7490",
  },
};

export function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|br|li|h\d|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isBrandedEmailHtml(html: string) {
  return html.includes(BRAND_MARKER);
}

function absoluteAssetUrl(url: string | null | undefined) {
  const value = url?.trim();
  if (!value) return null;
  if (/^(https?:|data:)/i.test(value)) return value;
  if (value.startsWith("/")) return `${APP_URL}${value}`;
  return value;
}

function applyBrandingToExistingHtml(
  html: string,
  brand: BrandedEmailArgs["brand"],
) {
  const brandName = brand?.name?.trim();
  const brandLogoUrl = absoluteAssetUrl(brand?.logoUrl);
  if (!brandName && !brandLogoUrl) return html;

  let next = html;
  if (brandLogoUrl) {
    next = next.replace(
      /(<img[^>]*data-email-brand-logo="true"[^>]*src=")[^"]*("[^>]*>)/i,
      `$1${brandLogoUrl}$2`,
    );
  }
  if (brandName) {
    next = next.replace(
      /(<div[^>]*data-email-brand-name="true"[^>]*>)[\s\S]*?(<\/div>)/i,
      `$1${brandName}$2`,
    );
  }
  return next;
}

export function renderBrandedEmail({
  title,
  preheader,
  eyebrow = "EduSentrix",
  bodyHtml,
  brand,
  cta,
  footerNote,
  tone = "default",
}: BrandedEmailArgs) {
  if (isBrandedEmailHtml(bodyHtml)) {
    return applyBrandingToExistingHtml(bodyHtml, brand);
  }

  const colors = toneColors[tone];
  const year = new Date().getFullYear();
  const safePreheader = preheader || title;
  const schoolSenderName = brand?.name?.trim() || null;
  const brandName = schoolSenderName || EDUSENTRIX_LOGO_ALT;
  const brandLogoUrl = absoluteAssetUrl(brand?.logoUrl) || EDUSENTRIX_LOGO_URL;
  const senderLine = schoolSenderName
    ? `Official message from ${schoolSenderName}`
    : "Official message from EduSentrix";
  const footerSenderLine = schoolSenderName
    ? `This message was sent by <strong style="color:#334155;">${schoolSenderName}</strong> through EduSentrix.`
    : "This message was sent by EduSentrix.";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${title}</title>
  </head>
  <body style="margin:0; padding:0; background:#f8fafc; color:#0f172a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <!-- ${BRAND_MARKER} -->
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">${safePreheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px; overflow:hidden; border-radius:18px; background:#ffffff; border:1px solid #e2e8f0; box-shadow:0 18px 48px rgba(15,23,42,0.08);">
            <tr>
              <td style="padding:0; background:${colors.header}; border-bottom:1px solid ${colors.headerBorder};">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding:26px 30px 28px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="vertical-align:middle;">
                            <table role="presentation" cellspacing="0" cellpadding="0">
                              <tr>
                                <td style="width:58px; height:58px; border-radius:16px; background:#ffffff; border:1px solid rgba(148,163,184,0.28); box-shadow:0 8px 22px rgba(15,23,42,0.08); vertical-align:middle; text-align:center;">
                                  <img data-email-brand-logo="true" src="${brandLogoUrl}" alt="${brandName}" width="44" style="display:inline-block; max-width:44px; max-height:44px; height:auto; vertical-align:middle;">
                                </td>
                                <td style="padding-left:14px; vertical-align:middle;">
                                  <div data-email-brand-name="true" style="color:#0f172a; font-size:17px; font-weight:800; letter-spacing:0.01em;">${brandName}</div>
                                  <div style="margin-top:4px; color:#475569; font-size:13px; line-height:1.4;">${senderLine}</div>
                                </td>
                              </tr>
                            </table>
                          </td>
                          <td align="right" style="vertical-align:middle;">
                            <span style="display:inline-block; padding:7px 11px; border-radius:999px; background:#ffffff; border:1px solid rgba(148,163,184,0.28); color:#334155; font-size:11px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase;">EduSentrix</span>
                          </td>
                        </tr>
                      </table>
                      <div style="display:inline-block; margin-top:24px; padding:7px 11px; border-radius:999px; background:${colors.badgeBg}; color:${colors.badgeText}; font-size:11px; font-weight:800; letter-spacing:0.14em; text-transform:uppercase;">${eyebrow}</div>
                      <h1 style="margin:14px 0 0; color:#0f172a; font-size:28px; line-height:1.2; font-weight:800;">${title}</h1>
                      ${
                        preheader
                          ? `<p style="margin:10px 0 0; color:#475569; font-size:14px; line-height:1.6;">${preheader}</p>`
                          : ""
                      }
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 32px; color:#334155; font-size:15px; line-height:1.7;">
                <div style="padding:18px 20px; border-radius:16px; background:#f8fafc; border:1px solid #e2e8f0;">
                  ${bodyHtml}
                </div>
                ${
                  cta
                    ? `<div style="margin-top:26px;"><a href="${cta.href}" style="display:inline-block; border-radius:14px; background:${colors.accent}; color:#ffffff; font-weight:800; font-size:14px; text-decoration:none; padding:14px 22px;">${cta.label}</a></div>`
                    : ""
                }
                ${
                  footerNote
                    ? `<div style="margin-top:24px; padding:14px 16px; border-radius:16px; background:${colors.soft}; color:#475569; font-size:13px; line-height:1.6;">${footerNote}</div>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding:22px 30px 28px; background:#f8fafc; border-top:1px solid #e2e8f0;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding-right:12px; vertical-align:middle;">
                      <img src="${EDUSENTRIX_LOGO_URL}" alt="${EDUSENTRIX_LOGO_ALT}" width="96" style="display:block; max-width:96px; height:auto;">
                    </td>
                    <td style="vertical-align:middle;">
                      <p style="margin:0; color:#64748b; font-size:12px; line-height:1.6;">${footerSenderLine} Please do not share security codes or invitation links with anyone.</p>
                    </td>
                  </tr>
                </table>
                <p style="margin:10px 0 0; color:#94a3b8; font-size:12px;">&copy; ${year} EduSentrix. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderGenericBrandedEmail(args: {
  subject: string;
  htmlContent: string;
  preheader?: string;
  brand?: BrandedEmailArgs["brand"];
  tone?: EmailTone;
}) {
  return renderBrandedEmail({
    title: args.subject,
    preheader: args.preheader,
    bodyHtml: args.htmlContent,
    brand: args.brand,
    tone: args.tone,
  });
}
