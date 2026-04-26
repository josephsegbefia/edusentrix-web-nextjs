// src/lib/admissions/decision-emails.ts
// Render the per-cycle acceptance / rejection / waitlist email templates by
// interpolating the variables admins can reference in their `htmlBody` and
// `subject` strings (e.g. {{applicantFirstName}}, {{trackerUrl}}).

import type { IAdmissionApplication } from "@/models/AdmissionApplication";
import type { IAdmissionCycle } from "@/models/AdmissionCycle";

export type AdmissionDecisionEmailVariables = {
  applicantFirstName: string;
  applicantLastName: string;
  applicantFullName: string;
  guardianFirstName: string;
  guardianLastName: string;
  guardianFullName: string;
  schoolName: string;
  cycleName: string;
  referenceCode: string;
  trackerUrl: string;
  intendedGradeName: string;
  decisionNotes: string;
};

export function buildVariables(args: {
  application: IAdmissionApplication;
  cycle: IAdmissionCycle;
  schoolName: string;
  trackerUrl: string;
  intendedGradeName?: string | null;
  decisionNotes?: string | null;
}): AdmissionDecisionEmailVariables {
  const a = args.application;
  return {
    applicantFirstName: a.applicant.firstName ?? "",
    applicantLastName: a.applicant.lastName ?? "",
    applicantFullName:
      `${a.applicant.firstName ?? ""} ${a.applicant.lastName ?? ""}`.trim(),
    guardianFirstName: a.guardian.firstName ?? "",
    guardianLastName: a.guardian.lastName ?? "",
    guardianFullName:
      `${a.guardian.firstName ?? ""} ${a.guardian.lastName ?? ""}`.trim(),
    schoolName: args.schoolName,
    cycleName: args.cycle.name,
    referenceCode: a.referenceCode,
    trackerUrl: args.trackerUrl,
    intendedGradeName: args.intendedGradeName ?? "",
    decisionNotes: args.decisionNotes ?? "",
  };
}

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function interpolate(
  template: string,
  variables: AdmissionDecisionEmailVariables
): string {
  if (!template) return "";
  return template.replace(VARIABLE_PATTERN, (_match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      const value = variables[key as keyof AdmissionDecisionEmailVariables];
      return value == null ? "" : String(value);
    }
    return "";
  });
}

/** Default copy used when a cycle template body is empty / not customized. */
export function defaultBody(
  outcome: "accepted" | "rejected" | "waitlisted",
  variables: AdmissionDecisionEmailVariables
): string {
  if (outcome === "accepted") {
    return `
      <p>Dear ${variables.guardianFullName || "Guardian"},</p>
      <p>We are pleased to offer <strong>${variables.applicantFullName}</strong>
      a place at <strong>${variables.schoolName}</strong> for the
      <strong>${variables.cycleName}</strong> intake${
        variables.intendedGradeName
          ? ` in <strong>${variables.intendedGradeName}</strong>`
          : ""
      }.</p>
      ${
        variables.decisionNotes
          ? `<p>${variables.decisionNotes}</p>`
          : "<p>You will receive next steps for confirming the place shortly.</p>"
      }
      <p>Reference: <code>${variables.referenceCode}</code></p>
      <p>You can review the application status at any time:<br/>
      <a href="${variables.trackerUrl}">${variables.trackerUrl}</a></p>
    `;
  }
  if (outcome === "waitlisted") {
    return `
      <p>Dear ${variables.guardianFullName || "Guardian"},</p>
      <p><strong>${variables.applicantFullName}</strong> has been placed on the
      waitlist for the <strong>${variables.cycleName}</strong> intake at
      <strong>${variables.schoolName}</strong>. We will reach out as soon as a
      place opens up.</p>
      ${variables.decisionNotes ? `<p>${variables.decisionNotes}</p>` : ""}
      <p>Reference: <code>${variables.referenceCode}</code></p>
      <p>Track your application:<br/>
      <a href="${variables.trackerUrl}">${variables.trackerUrl}</a></p>
    `;
  }
  return `
    <p>Dear ${variables.guardianFullName || "Guardian"},</p>
    <p>Thank you for applying to <strong>${variables.schoolName}</strong> for
    the <strong>${variables.cycleName}</strong> intake. After careful review,
    we are unable to offer <strong>${variables.applicantFullName}</strong> a
    place at this time.</p>
    ${variables.decisionNotes ? `<p>${variables.decisionNotes}</p>` : ""}
    <p>We sincerely appreciate the time you took to apply and wish
    ${variables.applicantFirstName || "your child"} the very best.</p>
    <p>Reference: <code>${variables.referenceCode}</code></p>
  `;
}
