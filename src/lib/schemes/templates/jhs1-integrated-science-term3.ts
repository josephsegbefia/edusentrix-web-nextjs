const DEFAULT_TEACHING_ACTIVITIES =
  "Guide learners through inquiry, practical work and collaborative activities linked to the indicators.";
const DEFAULT_ASSESSMENT = "Questioning, class exercises, practical tasks and short written checks.";

export type SchemeTemplateRow = {
  weekNumber: number;
  strand: string;
  subStrand: string;
  contentStandard: string;
  indicators: string;
  teachingActivities: string;
  resources: string;
  assessment: string;
};

export const JHS1_INTEGRATED_SCIENCE_TERM3_TEMPLATE = {
  subject: "INTEGRATED SCIENCE",
  level: "JHS 1 / BASIC 7",
  title: "THIRD TERM SCHEME OF LEARNING",
  rows: [
    {
      weekNumber: 1,
      strand: "Diversity of Matter",
      subStrand: "Materials and their Properties",
      contentStandard: "B7.1.1.1",
      indicators: "B7.1.1.1.1\nB7.1.1.1.2",
      teachingActivities: DEFAULT_TEACHING_ACTIVITIES,
      resources:
        "Assorted materials, charts, pictures, samples of solids, liquids and gases",
      assessment: DEFAULT_ASSESSMENT,
    },
    {
      weekNumber: 2,
      strand: "Diversity of Matter",
      subStrand: "States of Matter",
      contentStandard: "B7.1.2.1",
      indicators: "B7.1.2.1.1\nB7.1.2.1.2",
      teachingActivities: DEFAULT_TEACHING_ACTIVITIES,
      resources: "Ice, water, kettle/heater, beakers, balloons, videos/pictures",
      assessment: DEFAULT_ASSESSMENT,
    },
    {
      weekNumber: 3,
      strand: "Diversity of Matter",
      subStrand: "Mixtures and Separation",
      contentStandard: "B7.1.3.1",
      indicators: "B7.1.3.1.1\nB7.1.3.1.2",
      teachingActivities: DEFAULT_TEACHING_ACTIVITIES,
      resources: "Sand, salt, water, filter paper, funnel, magnet, sieves",
      assessment: DEFAULT_ASSESSMENT,
    },
    {
      weekNumber: 4,
      strand: "Cycles",
      subStrand: "The Water Cycle",
      contentStandard: "B7.2.1.1",
      indicators: "B7.2.1.1.1\nB7.2.1.1.2",
      teachingActivities: DEFAULT_TEACHING_ACTIVITIES,
      resources: "Water-cycle chart, projector, pictures, transparent bowl, plastic wrap",
      assessment: DEFAULT_ASSESSMENT,
    },
    {
      weekNumber: 5,
      strand: "Cycles",
      subStrand: "Weather and Climate",
      contentStandard: "B7.2.2.1",
      indicators: "B7.2.2.1.1\nB7.2.2.1.2",
      teachingActivities: DEFAULT_TEACHING_ACTIVITIES,
      resources: "Weather instruments, thermometer, rain gauge, weather charts",
      assessment: DEFAULT_ASSESSMENT,
    },
    {
      weekNumber: 6,
      strand: "Systems",
      subStrand: "The Human Body: Digestive System",
      contentStandard: "B7.3.1.1",
      indicators: "B7.3.1.1.1\nB7.3.1.1.2",
      teachingActivities: DEFAULT_TEACHING_ACTIVITIES,
      resources: "Human torso chart/model, food samples, digestive system diagram",
      assessment: DEFAULT_ASSESSMENT,
    },
    {
      weekNumber: 7,
      strand: "Systems",
      subStrand: "The Human Body: Respiratory System",
      contentStandard: "B7.3.2.1",
      indicators: "B7.3.2.1.1\nB7.3.2.1.2",
      teachingActivities: DEFAULT_TEACHING_ACTIVITIES,
      resources: "Lung model, balloons, bottle model, charts, short video",
      assessment: DEFAULT_ASSESSMENT,
    },
    {
      weekNumber: 8,
      strand: "Forces and Energy",
      subStrand: "Forms and Sources of Energy",
      contentStandard: "B7.4.1.1",
      indicators: "B7.4.1.1.1\nB7.4.1.1.2",
      teachingActivities: DEFAULT_TEACHING_ACTIVITIES,
      resources: "Torchlight, battery, solar image/cards, energy source charts",
      assessment: DEFAULT_ASSESSMENT,
    },
    {
      weekNumber: 9,
      strand: "Forces and Energy",
      subStrand: "Electric Circuits",
      contentStandard: "B7.4.2.1",
      indicators: "B7.4.2.1.1\nB7.4.2.1.2",
      teachingActivities: DEFAULT_TEACHING_ACTIVITIES,
      resources: "Cells/batteries, bulbs, switches, wires, circuit symbols chart",
      assessment: DEFAULT_ASSESSMENT,
    },
    {
      weekNumber: 10,
      strand: "Forces and Energy",
      subStrand: "Forces and Motion",
      contentStandard: "B7.4.3.1",
      indicators: "B7.4.3.1.1\nB7.4.3.1.2",
      teachingActivities: DEFAULT_TEACHING_ACTIVITIES,
      resources: "Toy cars, spring balance, meter rule, inclined plane, charts",
      assessment: DEFAULT_ASSESSMENT,
    },
    {
      weekNumber: 11,
      strand: "Humans and the Environment",
      subStrand: "Ecosystems and Habitats",
      contentStandard: "B7.5.1.1",
      indicators: "B7.5.1.1.1\nB7.5.1.1.2",
      teachingActivities: DEFAULT_TEACHING_ACTIVITIES,
      resources: "School compound observation, pictures, food chain cards, videos",
      assessment: DEFAULT_ASSESSMENT,
    },
    {
      weekNumber: 12,
      strand: "Humans and the Environment",
      subStrand: "Environmental Pollution and Conservation",
      contentStandard: "B7.5.2.1",
      indicators: "B7.5.2.1.1\nB7.5.2.1.2",
      teachingActivities: DEFAULT_TEACHING_ACTIVITIES,
      resources: "Pictures/videos of pollution, waste samples, posters, charts",
      assessment: DEFAULT_ASSESSMENT,
    },
    {
      weekNumber: 13,
      strand: "REVISION",
      subStrand: "Revision of Term's Work",
      contentStandard: "-",
      indicators: "Review all key indicators covered in Weeks 1-12",
      teachingActivities:
        "Guide whole-class revision of term topics using past questions, quick drills and practical recall.",
      resources: "Past questions, worksheets, charts, practical materials",
      assessment: "Mixed revision exercises and short written tasks.",
    },
    {
      weekNumber: 14,
      strand: "EXAMINATION",
      subStrand: "End of Term Examination",
      contentStandard: "-",
      indicators: "Conduct end-of-term assessment",
      teachingActivities: "Supervise end-of-term examination under school examination policy.",
      resources: "Question papers, answer booklets, marking scheme",
      assessment: "End-of-term written examination.",
    },
    {
      weekNumber: 15,
      strand: "CLOSING",
      subStrand: "Exam Review / Closing Activities",
      contentStandard: "-",
      indicators: "Discuss selected examination items and complete records",
      teachingActivities: "Review marked scripts with learners and complete term records.",
      resources: "Marked scripts, report sheets, class records",
      assessment: "Oral review of selected examination items.",
    },
  ] satisfies SchemeTemplateRow[],
};
