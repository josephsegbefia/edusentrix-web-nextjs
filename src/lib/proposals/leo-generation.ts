import OpenAI from "openai";
import type { IProposal, IProposalPricing } from "@/models/Proposal";
import { ProposalBranding, type IProposalBranding } from "@/models/ProposalBranding";
import type { IProposalTemplateSection, ProposalType } from "@/models/ProposalTemplate";
import { SubscriptionTier } from "@/models/SubscriptionTier";
import { PLAN_CODES } from "@/lib/subscriptions/plan-codes";
import { defaultProposalSections } from "@/lib/proposals/defaults";
import { sanitizeProposalHtml } from "@/lib/proposals/utils";

type LeoTone = "formal" | "executive" | "warm" | "simple";
type LeoSource = "leo" | "fallback";

type ProposalForLeo = Pick<
  IProposal,
  "schoolName" | "schoolLocation" | "proposalType" | "selectedModules" | "pricing"
>;

type ProposalBrandingForLeo = Pick<
  IProposalBranding,
  "brandName" | "tagline" | "website" | "contactEmail" | "whatsapp" | "address"
>;

export type SubscriptionTierForLeo = {
  code: string;
  name: string;
  description: string;
  billingCadence: string;
  currency: string;
  pricePerStudentPerTerm: string | null;
  minimumTermFee: string | null;
  annualDiscountPercent: number | null;
  onboardingFee: string | null;
  featureCount: number;
  sampleFeatures: string[];
  publicVisible: boolean;
};

function formatMinorAmount(value?: number | null, currency = "GHS") {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${currency} ${(value / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function sectionText(section: Pick<IProposalTemplateSection, "key" | "title">) {
  return `${section.key} ${section.title}`.toLowerCase();
}

export function isMobileAppProposalSection(section: Pick<IProposalTemplateSection, "key" | "title">) {
  const text = sectionText(section);
  return text.includes("mobile") || text.includes("companion");
}

export function isSubscriptionPricingProposalSection(section: Pick<IProposalTemplateSection, "key" | "title">) {
  const text = sectionText(section);
  return (
    text.includes("pricing") ||
    text.includes("subscription") ||
    text.includes("cost") ||
    text.includes("investment")
  );
}

export function isProposedSolutionProposalSection(section: Pick<IProposalTemplateSection, "key" | "title">) {
  const text = sectionText(section);
  return section.key === "solution" || text.includes("proposed solution");
}

export function isContactProposalSection(section: Pick<IProposalTemplateSection, "key" | "title">) {
  const text = sectionText(section);
  return section.key === "contact" || text.includes("contact") || text.includes("enquiries");
}

export async function loadProposalBrandingForLeo(): Promise<ProposalBrandingForLeo> {
  const branding = await ProposalBranding.findOne({}).lean();
  return {
    brandName: branding?.brandName || "EduSentrix",
    tagline: branding?.tagline || "Modern School Management Platform",
    website: branding?.website || "https://www.tryedusentrix.app",
    contactEmail: branding?.contactEmail || "hello@tryedusentrix.app",
    whatsapp: branding?.whatsapp || "0504211501",
    address: branding?.address || "",
  };
}

export function mergeDefaultProposalSections(
  sections: IProposalTemplateSection[],
) {
  const existingByKey = new Map(sections.map((section) => [section.key, section]));
  const defaults = defaultProposalSections();
  const knownSections = defaults.map((section) => existingByKey.get(section.key) || section);
  const customSections = sections.filter((section) => !defaults.some((item) => item.key === section.key));

  return [...knownSections, ...customSections]
    .sort((a, b) => a.order - b.order)
    .map((section, index) => ({
      key: section.key,
      title: section.title,
      subtitle: section.subtitle || "",
      content: section.content || "",
      order: index + 1,
      enabled: Boolean(section.enabled),
      displayStyle: section.displayStyle || "standard",
      pageBreakBefore: Boolean(section.pageBreakBefore),
      pageBreakAfter: Boolean(section.pageBreakAfter),
    }));
}

export async function loadSubscriptionTiersForProposal(proposalType: ProposalType) {
  const codes =
    proposalType === "pilot"
      ? Object.values(PLAN_CODES)
      : [PLAN_CODES.STARTER, PLAN_CODES.GROWTH, PLAN_CODES.ENTERPRISE];

  const tiers = await SubscriptionTier.find({
    code: { $in: codes },
    active: true,
    ...(proposalType === "pilot" ? {} : { publicVisible: true }),
  })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  return tiers.map<SubscriptionTierForLeo>((tier) => {
    const currency = tier.pricing?.currency || "GHS";
    return {
      code: tier.code,
      name: tier.name,
      description: tier.description || "",
      billingCadence: tier.billingCadence,
      currency,
      pricePerStudentPerTerm: formatMinorAmount(tier.pricing?.pricePerStudentPerTermMinor, currency),
      minimumTermFee: formatMinorAmount(tier.pricing?.minimumTermFeeMinor, currency),
      annualDiscountPercent:
        typeof tier.pricing?.annualDiscountPercent === "number" ? tier.pricing.annualDiscountPercent : null,
      onboardingFee: formatMinorAmount(tier.pricing?.onboardingFeeMinor, currency),
      featureCount: tier.features?.length || 0,
      sampleFeatures: (tier.features || []).slice(0, 8),
      publicVisible: Boolean(tier.publicVisible),
    };
  });
}

function fallbackDraft(input: {
  section: Pick<IProposalTemplateSection, "key" | "title" | "content">;
  schoolName: string;
  selectedModules: string[];
  subscriptionTiers: SubscriptionTierForLeo[];
  pricing?: IProposalPricing | null;
  branding?: ProposalBrandingForLeo | null;
}) {
  const modules = input.selectedModules.slice(0, 6).join(", ");
  const sender = input.branding || {
    brandName: "EduSentrix",
    website: "https://www.tryedusentrix.app",
    contactEmail: "hello@tryedusentrix.app",
    whatsapp: "0504211501",
    tagline: "Modern School Management Platform",
    address: "",
  };

  if (isContactProposalSection(input.section)) {
    return [
      `For questions, clarifications, or next steps regarding this proposal for ${input.schoolName}, please contact ${sender.brandName}.`,
      [
        `${sender.brandName}`,
        sender.contactEmail ? `Email: ${sender.contactEmail}` : "",
        sender.website ? `Website: ${sender.website}` : "",
        sender.whatsapp ? `Phone/WhatsApp: ${sender.whatsapp}` : "",
        sender.address ? `Address: ${sender.address}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      `We would be happy to walk your team through the proposal, answer questions, and discuss the best rollout approach for ${input.schoolName}.`,
    ].join("\n\n");
  }

  if (isMobileAppProposalSection(input.section)) {
    return [
      `${input.schoolName} can extend EduSentrix beyond the school office through two companion mobile apps: Jeda and EduSentrix Learn.`,
      "Jeda is the mobile version of the EduSentrix web platform, giving the school community a convenient way to access key school workflows and information from a phone.",
      "EduSentrix Learn is the student learning companion. It helps learners revisit topics taught in class, reinforce what they have learned, revise before assessments, and prepare more confidently for exams.",
      "The mobile experience should be positioned as support for classroom teaching and school operations, not as a replacement for teachers or school leadership.",
    ].join("\n\n");
  }

  if (isSubscriptionPricingProposalSection(input.section)) {
    const planSections = input.subscriptionTiers.map((tier) => {
      const price = tier.pricePerStudentPerTerm
        ? `${tier.pricePerStudentPerTerm} per student per term`
        : "pricing configured by EduSentrix";
      const lines = [
        tier.name,
        tier.description ? `Description: ${tier.description}` : "",
        `Billing cadence: ${tier.billingCadence}`,
        `Price: ${price}`,
        tier.minimumTermFee ? `Minimum term fee: ${tier.minimumTermFee}` : "",
        tier.annualDiscountPercent ? `Annual prepayment discount: ${tier.annualDiscountPercent}%` : "",
        tier.featureCount ? `Feature coverage: ${tier.featureCount} configured features.` : "",
      ].filter(Boolean);
      return lines.join("\n");
    });

    return [
      "EduSentrix subscription pricing should be presented from the current platform subscription tiers and confirmed before sending the proposal.",
      planSections.length
        ? planSections.join("\n\n")
        : "No active public subscription tiers were available when this draft was generated, so pricing should be confirmed from the platform subscription plan setup.",
      "This section is indicative proposal copy, not a signed quote or contract. Final fees should reflect the selected tier, billing cadence, active student count, applicable minimum fee, and any approved implementation or discount terms.",
    ].join("\n\n");
  }

  if (isProposedSolutionProposalSection(input.section)) {
    const selectedModules = input.selectedModules.slice(0, 12);
    return [
      `EduSentrix provides ${input.schoolName} with a unified school operations platform that brings administration, academics, finance, communication, reporting, and role-based access into one structured environment.`,
      "The proposed solution is designed to reduce manual follow-up, improve visibility for school leadership, and give staff a clearer way to manage daily work across departments.",
      selectedModules.length
        ? ["Selected modules", ...selectedModules.map((module) => `- ${module}`)].join("\n")
        : "The selected modules can be refined further after the school confirms its immediate operational priorities.",
      "Together, these modules provide a practical implementation path that can be reviewed, phased, and adjusted around the school's readiness and rollout priorities.",
    ].join("\n\n");
  }

  return [
    `${input.schoolName} can use EduSentrix to strengthen the way this area of school operations is planned, monitored, and reviewed.`,
    `For ${input.section.title.toLowerCase()}, the platform brings the relevant information into one structured workspace, reducing manual follow-up and giving leadership clearer visibility.`,
    modules
      ? `The most relevant capabilities for this proposal include ${modules}.`
      : "The proposal can be tailored further after the school confirms its immediate priorities.",
    "This draft should be reviewed and adjusted to match the exact discussion held with the school.",
  ].join("\n\n");
}

export async function generateProposalSectionWithLeo(input: {
  proposal: ProposalForLeo;
  section: IProposalTemplateSection;
  subscriptionTiers: SubscriptionTierForLeo[];
  branding?: ProposalBrandingForLeo | null;
  instruction?: string | null;
  tone?: LeoTone;
}): Promise<{ content: string; source: LeoSource }> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      content: fallbackDraft({
        section: input.section,
        schoolName: input.proposal.schoolName,
        selectedModules: input.proposal.selectedModules,
        subscriptionTiers: input.subscriptionTiers,
        pricing: input.proposal.pricing,
        branding: input.branding,
      }),
      source: "fallback",
    };
  }

  const sectionGuidance = {
    formatting:
      "Use clean proposal body copy only. Do not use markdown heading markers such as #, ##, ###, or ####. Do not use markdown bold markers such as **text**. Do not repeat the section title as the first line of the section body. If the section needs internal grouping, use a plain label line such as Selected modules or Starter, followed by short paragraphs or simple hyphen bullets.",
    proposedSolution: isProposedSolutionProposalSection(input.section)
      ? "This is the Proposed Solution section. Explain EduSentrix as a unified school operations platform tailored to the recipient school. Mention selected modules only as clean plain-text grouping: a short intro paragraph, a plain label line such as Selected modules, then concise hyphen bullets for relevant modules. Do not use markdown heading markers, bold labels, or a long catalogue-style paragraph. Do not repeat the section title inside the body."
      : "",
    mobileApp: isMobileAppProposalSection(input.section)
      ? "This is the Companion Mobile App section. EduSentrix has two companion mobile apps: Jeda and EduSentrix Learn. Jeda is the mobile version of the EduSentrix web platform for convenient phone access to school workflows and information. EduSentrix Learn is the student learning companion that reinforces topics taught in school, supports revision, exam preparation, and continued learning outside the classroom. Keep the distinction clear. Do not describe EduSentrix Learn as the only companion app. Do not claim unsupported AI tutoring, offline mode, WhatsApp, or SMS features."
      : "",
    pricing: isSubscriptionPricingProposalSection(input.section)
      ? "This is a pricing/subscription section. Use only the subscriptionTiers data provided. Present each subscription tier as its own clear subsection using the tier name as a plain line, followed by concise fields such as description, billing cadence, price, minimum term fee, annual discount, and feature coverage. Do not use markdown heading markers like #, ##, ###, or ####. Do not repeat the section title inside the section body. Do not include a closing sentence telling the reader to refer to a detailed feature list elsewhere in the proposal. Present pricing as current indicative subscription options that must be reviewed before sending. Do not invent prices, discounts, contracts, validity dates, or commitments. Do not show the Pilot plan as a public plan unless proposalType is pilot."
      : "Do not include subscription pricing in this section unless the operator instruction explicitly asks for it.",
    contact: isContactProposalSection(input.section)
      ? "This is the proposal Contact section. The contact must be EduSentrix/Appsentrix as the sender, not the recipient school. Use senderContact.brandName, senderContact.contactEmail, senderContact.website, senderContact.whatsapp, and senderContact.address when available. The recipient school may be mentioned only as the school the proposal concerns. Do not output the recipient school name followed by its location as the contact owner."
      : "Do not add a contact block in this section unless the operator instruction explicitly asks for it.",
  };

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.45,
    max_tokens: 1200,
    messages: [
      {
        role: "system",
        content:
          "You are Leo, EduSentrix's proposal assistant. Return JSON only. Write polished, official business proposal copy. Do not invent prices, dates, contracts, legal commitments, implementation promises, or customer claims. Output must be editable draft text, not final approval.",
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Rewrite or draft this proposal section.",
          expectedJson: { content: "plain text with short paragraphs only" },
          tone: input.tone || "formal",
          instruction: input.instruction || "",
          sectionGuidance,
          proposal: {
            schoolName: input.proposal.schoolName,
            schoolLocation: input.proposal.schoolLocation,
            proposalType: input.proposal.proposalType,
            selectedModules: input.proposal.selectedModules,
            operatorPricingFields: input.proposal.pricing,
          },
          senderContact: input.branding || {
            brandName: "EduSentrix",
            tagline: "Modern School Management Platform",
            website: "https://www.tryedusentrix.app",
            contactEmail: "hello@tryedusentrix.app",
            whatsapp: "0504211501",
            address: "",
          },
          subscriptionTiers: input.subscriptionTiers,
          section: {
            key: input.section.key,
            title: input.section.title,
            currentContent: input.section.content,
          },
        }),
      },
    ],
  });

  const text = completion.choices[0]?.message?.content || "";
  const json = JSON.parse(text) as { content?: string };
  return {
    content: sanitizeProposalHtml(normalizeLeoProposalContent(String(json.content || ""))),
    source: "leo",
  };
}

function normalizeLeoProposalContent(content: string) {
  return content
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .trim();
}
