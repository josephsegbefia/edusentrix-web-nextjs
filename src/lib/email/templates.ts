import "server-only";
import { formatCurrency } from "@/lib/fees/money";
import { renderBrandedEmail, stripHtml } from "./branded-template";

const { APP_URL = "" } = process.env;

export type TemplateKey =
  | "SCHOOL_INVITE"
  | "SCHOOL_ONBOARDING"
  | "ADMIN_CREATED"
  | "USER_INVITE"
  | "APPLICATION_RECEIVED"
  | "REMINDER"
  | "FEE_REMINDER"
  | "PASSWORD_OTP";

export type TemplatePayload = {
  SCHOOL_INVITE: { schoolName: string; setupLink: string };
  APPLICATION_RECEIVED: { name: string };
  SCHOOL_ONBOARDING: { schoolName: string; contactPerson: string };
  ADMIN_CREATED: {
    name: string;
    email: string;
    schoolName: string;
    tempPassword?: string;
  };
  USER_INVITE: {
    name: string;
    role: string;
    schoolName: string;
    setupLink: string;
  };
  REMINDER: {
    title: string;
    name: string;
    time: string;
    location?: string;
    description?: string;
    actionLink?: string;
  };
  FEE_REMINDER: {
    schoolName: string;
    guardianName: string;
    totalOutstandingMinor: number;
    currency?: string;
    wards: Array<{
      studentName: string;
      classGroupName?: string;
      outstandingMinor: number;
      overdueInvoiceCount?: number;
    }>;
    customMessage?: string;
    actionLink?: string;
    subjectOverride?: string;
  };
  PASSWORD_OTP: {
    code: string;
  };
};

type Rendered = { subject: string; htmlContent: string; textContent?: string };

function formatMinorCurrency(minor: number, currency = "GHS") {
  return formatCurrency(minor ?? 0, { currency });
}

export const EmailTemplates: {
  [K in TemplateKey]: (data: TemplatePayload[K]) => Rendered;
} = {
  SCHOOL_INVITE: (data) => {
    const subject = "You've been invited to create a school on EduSentrix";
    const htmlContent = renderBrandedEmail({
      title: "Create your school workspace",
      eyebrow: "School setup",
      preheader: `Set up ${data.schoolName} on EduSentrix.`,
      bodyHtml: `
        <p style="margin:0 0 14px;">Hello,</p>
        <p style="margin:0 0 14px;">You have been invited to onboard <strong>${data.schoolName}</strong> on EduSentrix.</p>
        <p style="margin:0;">Use the secure link below to start the setup process.</p>
      `,
      cta: { label: "Set Up My School", href: data.setupLink },
      footerNote:
        "This invitation link expires in 7 days. If you were not expecting this invitation, you can ignore this message.",
    });
    return { subject, htmlContent, textContent: stripHtml(htmlContent) };
  },

  APPLICATION_RECEIVED: (data) => {
    const htmlContent = renderBrandedEmail({
      title: "Application received",
      eyebrow: "Thank you",
      preheader: "We have received your EduSentrix application.",
      bodyHtml: `
        <p style="margin:0 0 14px;">Hello ${data.name},</p>
        <p style="margin:0 0 14px;">Your application has been received successfully.</p>
        <p style="margin:0;">A customer service agent will review it and get in touch with you soon.</p>
      `,
      tone: "success",
    });
    return {
      subject: "EduSentrix: Application Received",
      htmlContent,
      textContent: stripHtml(htmlContent),
    };
  },

  SCHOOL_ONBOARDING: (data) => {
    const htmlContent = renderBrandedEmail({
      title: "Your school is ready",
      eyebrow: "Welcome",
      preheader: `${data.schoolName} has been successfully onboarded.`,
      bodyHtml: `
        <p style="margin:0 0 14px;">Dear ${data.contactPerson},</p>
        <p style="margin:0 0 14px;">Welcome to EduSentrix. <strong>${data.schoolName}</strong> has been successfully onboarded.</p>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:16px; border-radius:16px; margin:18px 0;">
          <p style="margin:0 0 8px; font-weight:800; color:#0f172a;">Recommended next steps</p>
          <ol style="margin:0; padding-left:20px;">
            <li>Complete the school profile.</li>
            <li>Add staff members.</li>
            <li>Set up classes and academic periods.</li>
          </ol>
        </div>
        <p style="margin:0;">Need help? Contact our support team anytime.</p>
      `,
      cta: { label: "Access Dashboard", href: `${APP_URL}/login` },
      tone: "success",
    });
    return {
      subject: `Welcome to EduSentrix, ${data.schoolName}!`,
      htmlContent,
      textContent: stripHtml(htmlContent),
    };
  },

  ADMIN_CREATED: (data) => {
    const htmlContent = renderBrandedEmail({
      title: "Admin account created",
      eyebrow: "Account access",
      preheader: `An admin account has been created for ${data.schoolName}.`,
      bodyHtml: `
        <p style="margin:0 0 14px;">Hello ${data.name},</p>
        <p style="margin:0 0 14px;">An admin account has been created for you at <strong>${data.schoolName}</strong>.</p>
        ${
          data.tempPassword
            ? `<div style="background:#f8fafc; border:1px solid #e2e8f0; padding:16px; border-radius:16px; margin:18px 0;">
                 <p style="margin:0 0 8px; font-weight:800; color:#0f172a;">Login details</p>
                 <p style="margin:0 0 6px;">Email: ${data.email}</p>
                 <p style="margin:0;">Temporary password: <strong>${data.tempPassword}</strong></p>
               </div>`
            : ""
        }
        <p style="margin:0;">For security, please change your password after your first login.</p>
      `,
      cta: { label: "Login Now", href: `${APP_URL}/login` },
      footerNote:
        "If you were not expecting this account, contact your school administrator immediately.",
    });
    return {
      subject: "Your EduSentrix Admin Account",
      htmlContent,
      textContent: stripHtml(htmlContent),
    };
  },

  USER_INVITE: (data) => {
    const htmlContent = renderBrandedEmail({
      title: `Welcome to ${data.schoolName}`,
      eyebrow: "Invitation",
      preheader: `You have been invited as ${data.role}.`,
      bodyHtml: `
        <p style="margin:0 0 14px;">Hello ${data.name},</p>
        <p style="margin:0 0 14px;">You have been added as a <strong>${data.role}</strong> at <strong>${data.schoolName}</strong>.</p>
        <p style="margin:0;">Complete your account setup to start using EduSentrix.</p>
      `,
      cta: { label: "Complete Setup", href: data.setupLink },
      footerNote:
        "This invitation link expires in 7 days. If you have any questions, contact your school administrator.",
    });
    return {
      subject: `You've been added to ${data.schoolName}`,
      htmlContent,
      textContent: stripHtml(htmlContent),
    };
  },

  REMINDER: (data) => {
    const htmlContent = renderBrandedEmail({
      title: data.title,
      eyebrow: "Reminder",
      preheader: `Reminder for ${data.time}.`,
      bodyHtml: `
        <p style="margin:0 0 14px;">Hello ${data.name},</p>
        <p style="margin:0 0 14px;">This is a reminder about the following event:</p>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:16px; border-radius:16px; margin:18px 0;">
          <p style="margin:0 0 6px;"><strong>Event:</strong> ${data.title}</p>
          <p style="margin:0 0 6px;"><strong>Date & Time:</strong> ${data.time}</p>
          <p style="margin:0;"><strong>Location:</strong> ${data.location || "Online"}</p>
          ${
            data.description
              ? `<p style="margin:10px 0 0;"><strong>Description:</strong> ${data.description}</p>`
              : ""
          }
        </div>
      `,
      cta: data.actionLink
        ? { label: "View Details", href: data.actionLink }
        : undefined,
    });
    return {
      subject: `Reminder: ${data.title}`,
      htmlContent,
      textContent: stripHtml(htmlContent),
    };
  },

  FEE_REMINDER: (data) => {
    const currency = data.currency || "GHS";
    const totalFormatted = formatMinorCurrency(data.totalOutstandingMinor, currency);
    const rows = data.wards
      .slice(0, 8)
      .map((ward) => {
        const amount = formatMinorCurrency(ward.outstandingMinor, currency);
        const overdueText = ward.overdueInvoiceCount
          ? ` • ${ward.overdueInvoiceCount} overdue`
          : "";
        return `
          <tr>
            <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb;">${ward.studentName}</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${ward.classGroupName || "—"}</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${amount}${overdueText}</td>
          </tr>
        `;
      })
      .join("");

    const moreCount = Math.max(0, data.wards.length - 8);
    const actionLink = data.actionLink || `${APP_URL}/parent/fees`;
    const htmlContent = renderBrandedEmail({
      title: "Outstanding fee reminder",
      eyebrow: "Billing",
      preheader: `${data.schoolName} has sent a fee balance reminder.`,
      tone: "billing",
      bodyHtml: `
        <p style="margin:0 0 14px;">Hello ${data.guardianName},</p>
        <p style="margin:0 0 14px;">This is a reminder from <strong>${data.schoolName}</strong> about outstanding school fees.</p>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:16px; border-radius:16px; margin:18px 0;">
          <p style="margin:0 0 6px;"><strong>Total outstanding:</strong> ${totalFormatted}</p>
          <p style="margin:0;"><strong>Wards:</strong> ${data.wards.length}</p>
        </div>
        ${
          data.customMessage
            ? `<p style="background:#fff7ed; border:1px solid #fed7aa; padding:12px 14px; border-radius:14px;">${data.customMessage}</p>`
            : ""
        }
        <table style="width:100%; border-collapse:collapse; margin-top:18px; font-size:14px;">
          <thead>
            <tr>
              <th style="text-align:left; padding:10px 8px; border-bottom:1px solid #d1d5db; color:#0f172a;">Student</th>
              <th style="text-align:left; padding:10px 8px; border-bottom:1px solid #d1d5db; color:#0f172a;">Class</th>
              <th style="text-align:right; padding:10px 8px; border-bottom:1px solid #d1d5db; color:#0f172a;">Outstanding</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${
          moreCount > 0
            ? `<p style="font-size:12px; color:#64748b; margin-top:10px;">+${moreCount} more ward(s) not shown in this summary.</p>`
            : ""
        }
        <p style="margin:18px 0 0;">If you have already made payment, please ignore this message.</p>
      `,
      cta: { label: "View Fee Details", href: actionLink },
    });

    return {
      subject:
        data.subjectOverride?.trim() ||
        `Fee Reminder: Outstanding Balance - ${data.schoolName}`,
      htmlContent,
      textContent: stripHtml(htmlContent),
    };
  },

  PASSWORD_OTP: (data) => {
    const htmlContent = renderBrandedEmail({
      title: "Password reset code",
      eyebrow: "Security",
      preheader: "Use this one-time code to reset your EduSentrix password.",
      bodyHtml: `
        <p style="margin:0 0 14px;">Hello,</p>
        <p style="margin:0 0 16px;">You requested a password reset code. Enter the code below to continue:</p>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:24px; border-radius:18px; text-align:center; margin:18px 0;">
          <p style="font-size:34px; font-weight:900; letter-spacing:10px; color:#4f46e5; margin:0;">${data.code}</p>
        </div>
        <p style="margin:0;">This code expires in 10 minutes.</p>
      `,
      footerNote:
        "If you did not request this code, ignore this email or contact support if you have concerns.",
      tone: "warning",
    });
    return {
      subject: "Your EduSentrix Password Reset Code",
      htmlContent,
      textContent: stripHtml(htmlContent),
    };
  },
};

export function renderTemplate<K extends TemplateKey>(
  key: K,
  data: TemplatePayload[K]
): Rendered {
  const t = EmailTemplates[key](data as never);
  return {
    subject: t.subject,
    htmlContent: t.htmlContent,
    textContent: t.textContent ?? stripHtml(t.htmlContent),
  };
}
