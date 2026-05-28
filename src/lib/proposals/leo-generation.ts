import OpenAI from "openai";
import type { IProposal, IProposalPricing } from "@/models/Proposal";
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
}) {
  const modules = input.selectedModules.slice(0, 6).join(", ");

  if (isMobileAppProposalSection(input.section)) {
    return [
      `${input.schoolName} can extend EduSentrix beyond the school office through the companion mobile experience for parents, guardians, staff, and students.`,
      "A key part of this experience is EduSentrix Learn, the student mobile app designed to help learners revisit topics taught in class, study at their own pace, revise before assessments, and prepare more confidently for exams.",
      "EduSentrix Learn should be positioned as a guided learning companion that reinforces classroom teaching instead of replacing teachers. The final copy should be adjusted to match the exact modules enabled for the school.",
    ].join("\n\n");
  }

  if (isSubscriptionPricingProposalSection(input.section)) {
    const planLines = input.subscriptionTiers.map((tier) => {
      const price = tier.pricePerStudentPerTerm
        ? `${tier.pricePerStudentPerTerm} per student per term`
        : "pricing configured by EduSentrix";
      const minimum = tier.minimumTermFee ? `, minimum ${tier.minimumTermFee} per term` : "";
      const discount = tier.annualDiscountPercent ? `, ${tier.annualDiscountPercent}% annual prepayment discount` : "";
      return `${tier.name}: ${price}${minimum}${discount}.`;
    });

    return [
      "EduSentrix subscription pricing should be presented from the current platform subscription tiers and confirmed before sending the proposal.",
      planLines.length
        ? planLines.join("\n")
        : "No active public subscription tiers were available when this draft was generated, so pricing should be confirmed from the platform subscription plan setup.",
      "This section is indicative proposal copy, not a signed quote or contract. Final fees should reflect the selected tier, billing cadence, active student count, applicable minimum fee, and any approved implementation or discount terms.",
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
      }),
      source: "fallback",
    };
  }

  const sectionGuidance = {
    mobileApp: isMobileAppProposalSection(input.section)
      ? "This is the Companion Mobile App section. Explicitly mention EduSentrix Learn by name as the student mobile app that helps students learn topics taught in class on their own, revise, prepare for exams, and continue learning outside the classroom. Keep it truthful and do not claim unsupported AI tutoring, offline mode, WhatsApp, or SMS features."
      : "",
    pricing: isSubscriptionPricingProposalSection(input.section)
      ? "This is a pricing/subscription section. Use only the subscriptionTiers data provided. Present pricing as current indicative subscription options that must be reviewed before sending. Do not invent prices, discounts, contracts, validity dates, or commitments. Do not show the Pilot plan as a public plan unless proposalType is pilot."
      : "Do not include subscription pricing in this section unless the operator instruction explicitly asks for it.",
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
    content: sanitizeProposalHtml(String(json.content || "")),
    source: "leo",
  };
}
