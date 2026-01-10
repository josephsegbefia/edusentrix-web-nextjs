import "server-only";

const { APP_URL } = process.env;

export type TemplateKey =
  | "SCHOOL_INVITE"
  | "SCHOOL_ONBOARDING"
  | "ADMIN_CREATED"
  | "USER_INVITE"
  | "APPLICATION_RECEIVED"
  | "REMINDER"
  | "PASSWORD_OTP"
  | "DEMO_MAGIC_LINK"
  | "DEMO_SALES_NOTIFICATION"
  | "DEMO_HIGH_INTENT_ALERT"
  | "DEMO_SESSION_ENDED";

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
  PASSWORD_OTP: {
    code: string;
  };
  DEMO_MAGIC_LINK: {
    name: string;
    magicLink: string;
    expiresInMinutes: number;
  };
  DEMO_SALES_NOTIFICATION: {
    leadName: string;
    leadEmail: string;
    organization: string;
    role: string;
    schoolSize?: string;
    country?: string;
    timestamp: string;
  };
  DEMO_HIGH_INTENT_ALERT: {
    leadName: string;
    leadEmail: string;
    organization: string;
    signals: string[];
    timeInDemo: string;
    featuresViewed: string[];
  };
  DEMO_SESSION_ENDED: {
    leadName: string;
    leadEmail: string;
    organization: string;
    duration: string;
    pagesVisited: string[];
    actionsAttempted: string[];
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

  // Demo Templates
  DEMO_MAGIC_LINK: (data) => {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <img src="${APP_URL}/logo.png" alt="Edusentrix" width="150">
        <h2 style="color: #4361ee;">Your EduSentrix Demo Awaits! 🎓</h2>
        <p>Hello ${data.name},</p>
        <p>Thank you for your interest in EduSentrix! Click the button below to access your personalized demo:</p>
        <a href="${data.magicLink}"
           style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #4361ee 0%, #3730a3 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; font-size: 16px;">
          🚀 Access My Demo
        </a>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #4361ee;">What you'll experience:</h3>
          <ul style="color: #495057;">
            <li>Complete school management dashboard</li>
            <li>Student & teacher management</li>
            <li>Class scheduling & assignments</li>
            <li>Fee management & invoicing</li>
            <li>Reports & analytics</li>
          </ul>
        </div>
        <p style="color: #6c757d; font-size: 0.9em;">⏰ This link expires in ${data.expiresInMinutes} minutes.</p>
        <p style="color: #6c757d; font-size: 0.9em;">Your demo session will last up to 2 hours.</p>
        <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
        <p style="font-size: 0.8em; color: #6c757d;">
          Questions? Reply to this email or contact us at <a href="mailto:sales@edusentrix.com">sales@edusentrix.com</a>
        </p>
        <p style="font-size: 0.8em; color: #6c757d;">© ${new Date().getFullYear()} Edusentrix</p>
      </div>
    `;
    return {
      subject: `🎓 Your EduSentrix Demo Access Link`,
      htmlContent,
      textContent: stripHtml(htmlContent),
    };
  },

  DEMO_SALES_NOTIFICATION: (data) => {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #4361ee 0%, #3730a3 100%); padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="color: white; margin: 0;">🎓 New Demo Signup!</h2>
        </div>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6c757d;">Name:</td>
              <td style="padding: 8px 0; font-weight: bold;">${data.leadName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6c757d;">Email:</td>
              <td style="padding: 8px 0;"><a href="mailto:${data.leadEmail}">${data.leadEmail}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6c757d;">Organization:</td>
              <td style="padding: 8px 0; font-weight: bold;">${data.organization}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6c757d;">Role:</td>
              <td style="padding: 8px 0;">${data.role}</td>
            </tr>
            ${data.schoolSize ? `<tr><td style="padding: 8px 0; color: #6c757d;">School Size:</td><td style="padding: 8px 0;">${data.schoolSize}</td></tr>` : ""}
            ${data.country ? `<tr><td style="padding: 8px 0; color: #6c757d;">Country:</td><td style="padding: 8px 0;">${data.country}</td></tr>` : ""}
            <tr>
              <td style="padding: 8px 0; color: #6c757d;">Time:</td>
              <td style="padding: 8px 0;">${data.timestamp}</td>
            </tr>
          </table>
        </div>
        <p style="font-size: 0.8em; color: #6c757d; margin-top: 20px;">© ${new Date().getFullYear()} Edusentrix Sales Notification</p>
      </div>
    `;
    return {
      subject: `🎓 New Demo: ${data.leadName} from ${data.organization}`,
      htmlContent,
      textContent: stripHtml(htmlContent),
    };
  },

  DEMO_HIGH_INTENT_ALERT: (data) => {
    const signalsList = data.signals.map((s) => `<li>✅ ${s}</li>`).join("");
    const featuresList = data.featuresViewed.slice(0, 10).map((f) => `<li>${f}</li>`).join("");
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="color: white; margin: 0;">🔥 HIGH INTENT LEAD!</h2>
        </div>
        <div style="background: #fffbeb; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #f59e0b;">
          <p style="font-size: 18px; margin-top: 0;"><strong>${data.leadName}</strong> from <strong>${data.organization}</strong></p>
          <p>📧 <a href="mailto:${data.leadEmail}">${data.leadEmail}</a></p>
          <p>⏱️ Time in demo: <strong>${data.timeInDemo}</strong></p>

          <h3 style="color: #d97706;">Intent Signals:</h3>
          <ul style="list-style: none; padding: 0;">${signalsList}</ul>

          <h3 style="color: #4361ee;">Features Explored:</h3>
          <ul>${featuresList}</ul>

          <a href="mailto:${data.leadEmail}?subject=EduSentrix%20Demo%20Follow-up"
             style="display: inline-block; padding: 12px 24px; background: #4361ee; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 10px 0;">
            📞 Contact Now
          </a>
        </div>
        <p style="font-size: 0.8em; color: #6c757d; margin-top: 20px;">© ${new Date().getFullYear()} Edusentrix Sales Alert</p>
      </div>
    `;
    return {
      subject: `🔥 HIGH INTENT: ${data.leadName} from ${data.organization}`,
      htmlContent,
      textContent: stripHtml(htmlContent),
    };
  },

  DEMO_SESSION_ENDED: (data) => {
    const pagesList = data.pagesVisited.slice(0, 15).map((p) => `<li>${p}</li>`).join("");
    const actionsList = data.actionsAttempted.slice(0, 10).map((a) => `<li>${a}</li>`).join("");
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="color: white; margin: 0;">📊 Demo Session Summary</h2>
        </div>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px;">
          <p><strong>${data.leadName}</strong> from <strong>${data.organization}</strong></p>
          <p>📧 <a href="mailto:${data.leadEmail}">${data.leadEmail}</a></p>
          <p>⏱️ Session duration: <strong>${data.duration}</strong></p>

          ${pagesList ? `<h3 style="color: #4361ee;">Pages Visited:</h3><ul>${pagesList}</ul>` : ""}
          ${actionsList ? `<h3 style="color: #4361ee;">Actions Attempted:</h3><ul>${actionsList}</ul>` : ""}

          <a href="mailto:${data.leadEmail}?subject=Thanks%20for%20trying%20EduSentrix"
             style="display: inline-block; padding: 12px 24px; background: #4361ee; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 10px 0;">
            ✉️ Send Follow-up
          </a>
        </div>
        <p style="font-size: 0.8em; color: #6c757d; margin-top: 20px;">© ${new Date().getFullYear()} Edusentrix Sales</p>
      </div>
    `;
    return {
      subject: `📊 Demo Ended: ${data.leadName} (${data.duration})`,
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
