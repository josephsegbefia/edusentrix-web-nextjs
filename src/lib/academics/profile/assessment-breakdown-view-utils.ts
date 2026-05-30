import type {
  AcademicProfileAssessmentEvidenceItemDTO,
  AcademicProfileScoreComponentDTO,
  AcademicProfileSubjectBreakdownDTO,
} from "@/types/academics/student-academic-profile";

export type BreakdownEvidencePartition = {
  counted: AcademicProfileAssessmentEvidenceItemDTO[];
  nonCounted: AcademicProfileAssessmentEvidenceItemDTO[];
  missing: AcademicProfileAssessmentEvidenceItemDTO[];
};

export function formatEvidenceScore(item: AcademicProfileAssessmentEvidenceItemDTO) {
  if (item.rawScore != null && item.rawMaxScore != null) {
    return `${item.rawScore}/${item.rawMaxScore}`;
  }
  if (item.rawPercentage != null) {
    return `${item.rawPercentage.toFixed(1)}%`;
  }
  return "—";
}

export function partitionBreakdownEvidence(
  items: AcademicProfileAssessmentEvidenceItemDTO[]
): BreakdownEvidencePartition {
  const counted: AcademicProfileAssessmentEvidenceItemDTO[] = [];
  const nonCounted: AcademicProfileAssessmentEvidenceItemDTO[] = [];
  const missing: AcademicProfileAssessmentEvidenceItemDTO[] = [];

  for (const item of items) {
    if (item.isMissing) {
      missing.push(item);
      continue;
    }
    if (item.isCounted) {
      counted.push(item);
      continue;
    }
    nonCounted.push(item);
  }

  return { counted, nonCounted, missing };
}

export function groupBreakdownItemsByComponent(
  items: AcademicProfileAssessmentEvidenceItemDTO[],
  components: AcademicProfileScoreComponentDTO[]
) {
  const groups = new Map<
    string,
    {
      component: AcademicProfileScoreComponentDTO;
      items: AcademicProfileAssessmentEvidenceItemDTO[];
    }
  >();

  for (const component of components) {
    groups.set(component.componentKey, { component, items: [] });
  }

  const generalKey = "general";
  for (const item of items) {
    const key = groups.has(item.componentKey) ? item.componentKey : generalKey;
    if (!groups.has(key)) {
      groups.set(key, {
        component: {
          componentKey: key,
          label: item.componentLabel,
          weight: 0,
          rawScore: null,
          rawMaxScore: null,
          rawPercentage: null,
          weightedScore: null,
          status: "complete",
        },
        items: [],
      });
    }
    groups.get(key)!.items.push(item);
  }

  const orderedKeys = [
    ...components.map((component) => component.componentKey),
    ...Array.from(groups.keys()).filter(
      (key) => !components.some((component) => component.componentKey === key)
    ),
  ];

  return orderedKeys
    .map((key) => groups.get(key))
    .filter((entry): entry is NonNullable<typeof entry> => !!entry && entry.items.length > 0);
}

export function shouldUseLegacyAssessmentBreakdown(input: {
  profileError: boolean;
  breakdown: AcademicProfileSubjectBreakdownDTO | null | undefined;
}) {
  if (input.profileError) {
    return true;
  }
  if (!input.breakdown) {
    return true;
  }
  return false;
}

export function formatComponentSummary(component: AcademicProfileScoreComponentDTO) {
  if (typeof component.weightedScore === "number") {
    return component.weightedScore.toFixed(1);
  }
  if (typeof component.rawPercentage === "number") {
    return `${component.rawPercentage.toFixed(1)}%`;
  }
  if (component.rawScore != null && component.rawMaxScore != null) {
    return `${component.rawScore}/${component.rawMaxScore}`;
  }
  return "—";
}
