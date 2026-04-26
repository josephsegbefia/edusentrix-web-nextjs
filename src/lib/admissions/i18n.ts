// src/lib/admissions/i18n.ts
//
// Localisation seed for the public admissions surface (form + tracker +
// lookup). This is intentionally tiny — it gives us a single place to swap
// copy without ripping it through the components.
//
// Phase 5 ships English (en) plus a French (fr) starter dictionary so that
// schools in francophone West Africa can opt in via the cycle's locale
// preference. Adding more locales is just a matter of dropping in another
// keyed object and falling back to `en` for any missing keys.
//
// Resolution rules:
//   • If a locale string is provided we honour it case-insensitively, then
//     fall back to the language part (`en-GB` → `en`).
//   • If the language is unsupported we fall back to English.
//   • Missing keys within a supported locale fall back to English so we can
//     ship partial translations safely.

export type AdmissionsLocale = "en" | "fr";

export type AdmissionsStrings = {
  // Application form
  formStepCounter: (current: number, total: number) => string;
  formProgressPercent: (pct: number) => string;
  formContinue: string;
  formBack: string;
  formSubmit: string;
  formSubmitting: string;
  formSkipToContent: string;
  formDocumentsTitle: string;
  formNoDocuments: string;
  formUploadInstructions: string;
  formClosedTitle: string;
  formClosedDefault: string;
  formRequiredFieldHint: string;
  formValidationToast: string;
  formDocumentsToast: string;
  formPoweredBy: (school: string) => string;

  // Field-level
  fieldRequired: string;
  fieldGradePlaceholder: string;
  fieldSelectPlaceholder: string;
  fieldEmailPlaceholder: string;
  fieldPhonePlaceholder: string;
  fieldAddressPlaceholder: string;

  // Tracker
  trackerLoading: string;
  trackerNotFoundTitle: string;
  trackerNotFoundBody: string;
  trackerCopyLink: string;
  trackerRefresh: string;
  trackerJustSubmittedTitle: string;
  trackerJustSubmittedBody: string;
  trackerLostLink: string;

  // Lookup portal
  lookupTitle: string;
  lookupSubtitle: string;
  lookupEmailLabel: string;
  lookupEmailPlaceholder: string;
  lookupSubmit: string;
  lookupSubmitting: string;
  lookupPrivacyNote: string;
  lookupSentTitle: string;
  lookupSentBodyDefault: string;
  lookupChangeEmail: string;
};

const en: AdmissionsStrings = {
  formStepCounter: (current, total) => `Step ${current} of ${total}`,
  formProgressPercent: (pct) => `${pct}% complete`,
  formContinue: "Continue",
  formBack: "Back",
  formSubmit: "Submit application",
  formSubmitting: "Submitting…",
  formSkipToContent: "Skip to application form",
  formDocumentsTitle: "Documents",
  formNoDocuments:
    "No documents are required for this application. You may continue.",
  formUploadInstructions:
    "Upload the supporting documents below. Required documents are marked.",
  formClosedTitle: "Applications are not currently open",
  formClosedDefault: "Please check back when the next admission cycle opens.",
  formRequiredFieldHint: "Required",
  formValidationToast: "Please fill in the required fields.",
  formDocumentsToast: "Please upload all required documents.",
  formPoweredBy: (school) =>
    `Powered by EduSentrix · Your information is shared only with ${school}.`,

  fieldRequired: "required",
  fieldGradePlaceholder: "Select grade",
  fieldSelectPlaceholder: "Choose an option",
  fieldEmailPlaceholder: "name@example.com",
  fieldPhonePlaceholder: "+233 ...",
  fieldAddressPlaceholder: "House / street, city, region",

  trackerLoading: "Loading your application…",
  trackerNotFoundTitle: "We could not find that application",
  trackerNotFoundBody: "Double-check the link, or contact the school for help.",
  trackerCopyLink: "Copy tracker link",
  trackerRefresh: "Refresh status",
  trackerJustSubmittedTitle: "Your application was submitted!",
  trackerJustSubmittedBody:
    "Bookmark this page or save the URL — it is your private tracker.",
  trackerLostLink: "Lost your link? Find all your applications",

  lookupTitle: "Find my admission applications",
  lookupSubtitle:
    "Enter the email you used when applying. We’ll send you the tracker link for each of your applications.",
  lookupEmailLabel: "Email address",
  lookupEmailPlaceholder: "parent@example.com",
  lookupSubmit: "Email me my applications",
  lookupSubmitting: "Sending links…",
  lookupPrivacyNote:
    "For your privacy, we never reveal whether an email is on file. You will only see the tracker links if your email matches an application.",
  lookupSentTitle: "Check your inbox",
  lookupSentBodyDefault:
    "If we found applications attached to that email, we’ve sent the tracker links to your inbox.",
  lookupChangeEmail: "Use a different email",
};

const fr: Partial<AdmissionsStrings> = {
  formStepCounter: (current, total) => `Étape ${current} sur ${total}`,
  formProgressPercent: (pct) => `${pct}% complété`,
  formContinue: "Continuer",
  formBack: "Retour",
  formSubmit: "Soumettre la candidature",
  formSubmitting: "Envoi…",
  formSkipToContent: "Aller au formulaire de candidature",
  formDocumentsTitle: "Documents",
  formNoDocuments:
    "Aucun document n’est requis pour cette candidature. Vous pouvez continuer.",
  formUploadInstructions:
    "Téléversez les documents ci-dessous. Les documents obligatoires sont indiqués.",
  formClosedTitle: "Les candidatures ne sont pas ouvertes pour l’instant",
  formClosedDefault:
    "Veuillez revenir lorsque le prochain cycle d’admission ouvrira.",
  formRequiredFieldHint: "Obligatoire",
  formValidationToast: "Veuillez remplir les champs obligatoires.",
  formDocumentsToast: "Veuillez téléverser tous les documents obligatoires.",
  formPoweredBy: (school) =>
    `Propulsé par EduSentrix · Vos informations ne sont partagées qu’avec ${school}.`,

  fieldRequired: "obligatoire",
  fieldGradePlaceholder: "Sélectionnez la classe",
  fieldSelectPlaceholder: "Choisissez une option",
  fieldEmailPlaceholder: "nom@exemple.com",
  fieldPhonePlaceholder: "+233 ...",
  fieldAddressPlaceholder: "Maison / rue, ville, région",

  trackerLoading: "Chargement de votre candidature…",
  trackerNotFoundTitle: "Nous n’avons pas trouvé cette candidature",
  trackerNotFoundBody:
    "Vérifiez le lien ou contactez l’école pour obtenir de l’aide.",
  trackerCopyLink: "Copier le lien de suivi",
  trackerRefresh: "Actualiser le statut",
  trackerJustSubmittedTitle: "Votre candidature a été soumise !",
  trackerJustSubmittedBody:
    "Ajoutez cette page à vos favoris ou enregistrez l’URL — c’est votre suivi privé.",
  trackerLostLink: "Lien perdu ? Retrouvez toutes vos candidatures",

  lookupTitle: "Retrouver mes candidatures",
  lookupSubtitle:
    "Saisissez l’adresse e-mail utilisée lors de la candidature. Nous vous enverrons le lien de suivi pour chaque candidature.",
  lookupEmailLabel: "Adresse e-mail",
  lookupEmailPlaceholder: "parent@exemple.com",
  lookupSubmit: "M’envoyer mes candidatures",
  lookupSubmitting: "Envoi des liens…",
  lookupPrivacyNote:
    "Pour votre confidentialité, nous ne révélons jamais si une adresse e-mail figure dans nos fichiers. Vous ne verrez les liens de suivi que si votre e-mail correspond à une candidature.",
  lookupSentTitle: "Consultez votre boîte de réception",
  lookupSentBodyDefault:
    "Si nous avons trouvé des candidatures liées à cet e-mail, nous vous avons envoyé les liens de suivi.",
  lookupChangeEmail: "Utiliser une autre adresse",
};

const DICTS: Record<AdmissionsLocale, Partial<AdmissionsStrings>> = {
  en,
  fr,
};

export function resolveLocale(
  raw: string | null | undefined
): AdmissionsLocale {
  if (!raw) return "en";
  const lower = raw.toLowerCase();
  if (lower === "fr" || lower.startsWith("fr-")) return "fr";
  return "en";
}

export function getAdmissionsStrings(
  locale: AdmissionsLocale | string | null | undefined
): AdmissionsStrings {
  const code = typeof locale === "string" ? resolveLocale(locale) : locale ?? "en";
  return { ...en, ...(DICTS[code] ?? {}) } as AdmissionsStrings;
}
