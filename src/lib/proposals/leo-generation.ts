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
  const modules = input.selectedModules.slice(0, 4).join(", ");
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
      [
        `${sender.brandName}`,
        sender.contactEmail ? `Email: ${sender.contactEmail}` : "",
        sender.website ? `Website: ${sender.website}` : "",
        sender.whatsapp ? `Phone/WhatsApp: ${sender.whatsapp}` : "",
        sender.address ? `Address: ${sender.address}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ].join("\n\n");
  }

  if (isMobileAppProposalSection(input.section)) {
    return [
      `${input.schoolName} can extend the web platform through Jeda for school workflows on mobile and EduSentrix Learn for student revision and reinforcement.`,
      "The mobile experience supports school operations and learning; it does not replace teachers, school leadership, or classroom instruction.",
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
      "Indicative pricing should be confirmed from the current platform subscription tiers before sending.",
      planSections.length
        ? planSections.join("\n\n")
        : "No active public subscription tiers were available when this draft was generated, so pricing should be confirmed from the platform subscription plan setup.",
      "Final fees should reflect the selected tier, billing cadence, active student count, applicable minimum fee, and approved implementation terms.",
    ].join("\n\n");
  }

  if (isProposedSolutionProposalSection(input.section)) {
    const selectedModules = input.selectedModules.slice(0, 5);
    return [
      `EduSentrix gives ${input.schoolName} one structured platform for the priority workflows selected for this proposal.`,
      selectedModules.length
        ? ["Selected modules", ...selectedModules.map((module) => `- ${module}`)].join("\n")
        : "The selected modules can be refined further after the school confirms its immediate operational priorities.",
    ].join("\n\n");
  }

  return [
    `${input.schoolName} can use EduSentrix to make this workflow easier to run, review, and improve.`,
    modules
      ? `The most relevant capabilities for this proposal include ${modules}.`
      : "The proposal can be tailored further after the school confirms its immediate priorities.",
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
      "Use clean proposal body copy only. Keep this section short: at most 90 words or 5 concise bullets. Do not use markdown heading markers such as #, ##, ###, or ####. Do not use markdown bold markers such as **text**. Do not repeat the section title as the first line of the section body. If the section needs internal grouping, use a plain label line such as Selected modules or Starter, followed by short paragraphs or simple hyphen bullets.",
    proposedSolution: isProposedSolutionProposalSection(input.section)
      ? "This is the Proposed Solution section. Explain EduSentrix as a focused school operations platform tailored to the recipient school. Mention at most 5 selected modules as concise hyphen bullets. Do not write a catalogue of features. Do not repeat the section title inside the body."
      : "",
    mobileApp: isMobileAppProposalSection(input.section)
      ? "This is the Companion Mobile App section. Keep it to 2 short paragraphs maximum. EduSentrix has two companion mobile apps: Jeda for school workflows and EduSentrix Learn for student revision and reinforcement. Do not claim unsupported AI tutoring, offline mode, WhatsApp, or SMS features."
      : "",
    pricing: isSubscriptionPricingProposalSection(input.section)
      ? "This is a pricing/subscription section. Keep it to one recommended option unless the operator asks for alternatives. Use only the subscriptionTiers data provided. Do not invent prices, discounts, contracts, validity dates, or commitments. Do not show the Pilot plan as a public plan unless proposalType is pilot."
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
    max_tokens: 450,
    messages: [
      {
        role: "system",
        content:
          "You are Leo, EduSentrix's proposal assistant. Return JSON only. Write short, polished business proposal copy. Standard proposals must fit within 2 pages; pilot, pricing, and demo follow-up proposals must fit within 1 page. Do not invent prices, dates, contracts, legal commitments, implementation promises, or customer claims. Output must be editable draft text, not final approval.",
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
