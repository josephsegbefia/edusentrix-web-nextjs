import "server-only";

const { APP_URL } = process.env;

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

const stripHtml = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|br|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();

import { formatCurrency } from "@/lib/fees/money";

function formatMinorCurrency(minor: number, currency = "GHS") {
  return formatCurrency(minor ?? 0, { currency });
}

export const EmailTemplates: {
  [K in TemplateKey]: (data: TemplatePayload[K]) => Rendered;
} = {
  SCHOOL_INVITE: (data) => ({
    subject: `You've been invited to create a school on Edusentrix`,
    htmlContent: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <img src="${APP_URL}/logo.png" alt="Edusentrix" width="150">
      <h2 style="color: #4361ee;">You're invited!</h2>
      <p>Hello,</p>
      <p>You’ve been invited to onboard your school, <strong>${
        data.schoolName
      }</strong>, on Edusentrix.</p>
      <p>Click the button below to start the setup process:</p>
      <a href="${data.setupLink}"
         style="display: inline-block; padding: 12px 24px; background: #4361ee; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 10px 0;">
        Set Up My School
      </a>
      <p style="margin-top: 20px;">This link will expire in 7 days.</p>
      <p>If you did not request this, you can ignore this message.</p>
      <p style="font-size: 0.8em; color: #6c757d;">© ${new Date().getFullYear()} Edusentrix</p>
    </div>`,
  }),

  APPLICATION_RECEIVED: (data) => {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <img src="${APP_URL}/logo.png" alt="Edusentrix" width="150">
        <h2 style="color: #4361ee;">Application Received</h2>
        <p>Hello ${data.name},</p>
        <p>Your application has been received. A customer service agent will get in touch with you soon.</p>
        <p>Thank you for choosing Edusentrix.</p>
        <p style="font-size: 0.8em; color: #6c757d;">© ${new Date().getFullYear()} Edusentrix</p>
      </div>
    `;
    return {
      subject: `EduSentrix: Application Received`,
      htmlContent,
      textContent: stripHtml(htmlContent),
    };
  },

  SCHOOL_ONBOARDING: (data) => {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <img src="${APP_URL}/logo.png" alt="Edusentrix" width="150">
        <h2 style="color: #4361ee;">Your School is Ready!</h2>
        <p>Dear ${data.contactPerson},</p>
        <p>Welcome to Edusentrix! <strong>${
          data.schoolName
        }</strong> has been successfully onboarded.</p>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3>Next Steps:</h3>
          <ol>
            <li>Complete your school profile</li>
            <li>Add staff members</li>
            <li>Set up your first classes</li>
          </ol>
        </div>
        <a href="${APP_URL}/login"
           style="display: inline-block; padding: 12px 24px; background: #4361ee; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 10px 0;">
          Access Dashboard
        </a>
        <p style="margin-top: 30px;">Need help? <a href="mailto:support@edusentrix.com">Contact our team</a></p>
        <p style="font-size: 0.8em; color: #6c757d;">© ${new Date().getFullYear()} Edusentrix. All rights reserved.</p>
      </div>
    `;
    return {
      subject: `Welcome to Edusentrix, ${data.schoolName}!`,
      htmlContent,
      textContent: stripHtml(htmlContent),
    };
  },

  ADMIN_CREATED: (data) => {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <img src="${APP_URL}/logo.png" alt="Edusentrix" width="150">
        <h2 style="color: #4361ee;">Admin Account Created</h2>
        <p>Hello ${data.name},</p>
        <p>An admin account has been created for you at <strong>${
          data.schoolName
        }</strong>.</p>
        ${
          data.tempPassword
            ? `<div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                 <p><strong>Login Details:</strong></p>
                 <p>Email: ${data.email}</p>
                 <p>Temporary Password: ${data.tempPassword}</p>
               </div>`
            : ""
        }
        <a href="${APP_URL}/login"
           style="display: inline-block; padding: 12px 24px; background: #4361ee; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 10px 0;">
          Login Now
        </a>
        <p style="margin-top: 20px;"><strong>Security Tip:</strong> Please change your password after first login.</p>
        <p style="font-size: 0.8em; color: #6c757d;">© ${new Date().getFullYear()} Edusentrix</p>
      </div>
    `;
    return {
      subject: `Your Edusentrix Admin Account`,
      htmlContent,
      textContent: stripHtml(htmlContent),
    };
  },

  USER_INVITE: (data) => {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <img src="${APP_URL}/logo.png" alt="Edusentrix" width="150">
        <h2 style="color: #4361ee;">Welcome to ${data.schoolName}!</h2>
        <p>Hello ${data.name},</p>
        <p>You've been added as a <strong>${data.role}</strong> at ${
      data.schoolName
    }.</p>
        <p>To get started, please set up your account:</p>
        <a href="${data.setupLink}"
           style="display: inline-block; padding: 12px 24px; background: #4361ee; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 10px 0;">
          Complete Setup
        </a>
        <p style="margin-top: 20px;">This link will expire in 7 days.</p>
        <p>If you have any questions, contact your school administrator.</p>
        <p style="font-size: 0.8em; color: #6c757d;">© ${new Date().getFullYear()} Edusentrix</p>
      </div>
    `;
    return {
      subject: `You've been added to ${data.schoolName}`,
      htmlContent,
      textContent: stripHtml(htmlContent),
    };
  },

  REMINDER: (data) => {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <img src="${APP_URL}/logo.png" alt="Edusentrix" width="150">
        <h2 style="color: #4361ee;">${data.title}</h2>
        <p>Hello ${data.name},</p>
        <p>This is a reminder about:</p>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Event:</strong> ${data.title}</p>
          <p><strong>Date & Time:</strong> ${data.time}</p>
          <p><strong>Location:</strong> ${data.location || "Online"}</p>
          ${
            data.description
              ? `<p><strong>Description:</strong> ${data.description}</p>`
              : ""
          }
        </div>
        ${
          data.actionLink
            ? `<a href="${data.actionLink}"
                 style="display: inline-block; padding: 12px 24px; background: #4361ee; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 10px 0;">
                 View Details
               </a>`
            : ""
        }
        <p style="font-size: 0.8em; color: #6c757d;">© ${new Date().getFullYear()} Edusentrix</p>
      </div>
    `;
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
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <img src="${APP_URL}/logo.png" alt="Edusentrix" width="150">
        <h2 style="color: #4361ee;">Outstanding Fee Reminder</h2>
        <p>Hello ${data.guardianName},</p>
        <p>This is a reminder from <strong>${data.schoolName}</strong> about outstanding school fees.</p>
        <div style="background: #f8fafc; padding: 14px; border-radius: 8px; margin: 14px 0;">
          <p style="margin: 0 0 4px 0;"><strong>Total Outstanding:</strong> ${totalFormatted}</p>
          <p style="margin: 0;"><strong>Wards:</strong> ${data.wards.length}</p>
        </div>
        ${
          data.customMessage
            ? `<p style="background:#fff7ed; border:1px solid #fed7aa; padding:10px; border-radius:8px;">${data.customMessage}</p>`
            : ""
        }
        <table style="width:100%; border-collapse:collapse; margin-top: 12px;">
          <thead>
            <tr>
              <th style="text-align:left; padding:10px 8px; border-bottom: 1px solid #d1d5db;">Student</th>
              <th style="text-align:left; padding:10px 8px; border-bottom: 1px solid #d1d5db;">Class</th>
              <th style="text-align:right; padding:10px 8px; border-bottom: 1px solid #d1d5db;">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        ${
          moreCount > 0
            ? `<p style="font-size: 12px; color: #6b7280; margin-top: 8px;">+${moreCount} more ward(s) not shown in this summary.</p>`
            : ""
        }
        <a href="${actionLink}"
           style="display: inline-block; padding: 12px 24px; background: #4361ee; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 18px 0 10px;">
          View Fee Details
        </a>
        <p>If you have already made payment, please ignore this message.</p>
        <p style="font-size: 0.8em; color: #6c757d;">© ${new Date().getFullYear()} Edusentrix</p>
      </div>
    `;

    return {
      subject:
        data.subjectOverride?.trim() ||
        `Fee Reminder: Outstanding Balance - ${data.schoolName}`,
      htmlContent,
      textContent: stripHtml(htmlContent),
    };
  },

  PASSWORD_OTP: (data) => {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <img src="${APP_URL}/logo.png" alt="Edusentrix" width="150">
        <h2 style="color: #4361ee;">Password Reset Code</h2>
        <p>Hello,</p>
        <p>You requested a password reset code. Use the code below to reset your password:</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #4361ee; margin: 0;">${data.code}</p>
        </div>
        <p style="color: #6c757d; font-size: 0.9em;">This code will expire in 10 minutes.</p>
        <p>If you did not request this code, please ignore this email or contact support if you have concerns.</p>
        <p style="font-size: 0.8em; color: #6c757d;">© ${new Date().getFullYear()} Edusentrix</p>
      </div>
    `;
    return {
      subject: `Your Edusentrix Password Reset Code`,
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
