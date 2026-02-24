/**
 * Curriculum-aware lesson note/planner template definitions.
 *
 * Maps each CurriculumCode to the lesson planning templates available for that
 * curriculum, along with curriculum-specific metadata field definitions and
 * the wizard step labels.
 */

import type { CurriculumCode } from "./curriculum-profiles";

// ============================================================================
// Template type — extended from the original 3 to include IB planners
// ============================================================================

export type LessonTemplateType =
  | "NACCA_3_PHASE"
  | "CLASSIC_JHS"
  | "SIMPLE"
  | "CAMBRIDGE_3_PART"
  | "BRITISH_3_PART"
  | "AMERICAN_STANDARDS"
  | "IB_PYP_UNIT_PLANNER"
  | "IB_MYP_UNIT_PLANNER";

// ============================================================================
// Planning granularity — daily lesson vs multi-week unit
// ============================================================================

export type PlanningGranularity = "daily" | "unit";

// ============================================================================
// Curriculum-specific metadata field definition
// ============================================================================

export interface CurriculumMetadataField {
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "richtext" | "indicator_list" | "outcome_list" | "tag_list" | "select";
  required?: boolean;
  options?: { value: string; label: string }[];
}

// ============================================================================
// Lesson body phase definition (for daily 3-phase templates)
// ============================================================================

export interface LessonPhaseField {
  key: string;
  label: string;
  placeholder: string;
  type: "richtext" | "text" | "number";
  required?: boolean;
}

export interface LessonPhase {
  key: string;
  label: string;
  defaultTimeMins: number;
  fields: LessonPhaseField[];
}

// ============================================================================
// IB Unit Planner section definition
// ============================================================================

export interface UnitPlannerSection {
  key: string;
  label: string;
  description?: string;
  fields: CurriculumMetadataField[];
}

// ============================================================================
// Template definition
// ============================================================================

export interface LessonTemplateDefinition {
  id: LessonTemplateType;
  label: string;
  shortLabel: string;
  description: string;
  granularity: PlanningGranularity;
  icon: "book" | "graduation" | "file" | "globe" | "compass" | "flag" | "layers";
  color: "indigo" | "emerald" | "amber" | "blue" | "violet" | "rose" | "cyan";

  /** Curriculum-specific metadata fields (replaces the generic strand/indicator step) */
  curriculumFields: CurriculumMetadataField[];

  /** Wizard step labels (override defaults per template) */
  wizardSteps: { id: string; label: string }[];

  /** Phase definitions for daily 3-phase-style templates */
  phases?: LessonPhase[];

  /** Section definitions for IB unit planners */
  unitSections?: UnitPlannerSection[];
}

// ============================================================================
// Shared metadata fields
// ============================================================================

const NACCA_CURRICULUM_FIELDS: CurriculumMetadataField[] = [
  { key: "strand", label: "Strand", placeholder: "e.g., Number", type: "text" },
  { key: "subStrand", label: "Sub-strand", placeholder: "e.g., Fractions", type: "text" },
  { key: "contentStandard", label: "Content Standard", placeholder: "e.g., B4.2.1 Demonstrate understanding of fractions...", type: "richtext" },
  { key: "indicators", label: "Indicators", placeholder: "B4.2.1.1", type: "indicator_list" },
  { key: "learningOutcomes", label: "Learning Outcomes", placeholder: "Learners will be able to...", type: "outcome_list" },
];

const CAMBRIDGE_CURRICULUM_FIELDS: CurriculumMetadataField[] = [
  { key: "learningObjective", label: "Learning Objective", placeholder: "e.g., 3Np.01 Count in ones, tens and hundreds...", type: "text", required: true },
  { key: "syllabusRef", label: "Syllabus Reference", placeholder: "e.g., Stage 3, Unit 2.1", type: "text" },
  { key: "successCriteria", label: "Success Criteria", placeholder: "By the end of this lesson, learners will be able to...", type: "outcome_list", required: true },
  { key: "languageSupport", label: "Language Support", placeholder: "Key vocabulary and language scaffolding", type: "richtext" },
  { key: "priorKnowledge", label: "Prior Knowledge", placeholder: "What learners should already know", type: "text" },
];

const BRITISH_CURRICULUM_FIELDS: CurriculumMetadataField[] = [
  { key: "learningObjective", label: "Learning Objective", placeholder: "e.g., Pupils should be taught to...", type: "text", required: true },
  { key: "nationalCurriculumRef", label: "NC Programme of Study Ref", placeholder: "e.g., KS2 Year 4 — Number: Fractions", type: "text" },
  { key: "successCriteria", label: "Success Criteria", placeholder: "All/Most/Some learners will...", type: "outcome_list", required: true },
  { key: "crossCurricular", label: "Cross-Curricular Links", placeholder: "Connections to other subjects", type: "text" },
];

const AMERICAN_CURRICULUM_FIELDS: CurriculumMetadataField[] = [
  { key: "standardCodes", label: "CCSS Standards", placeholder: "e.g., CCSS.MATH.CONTENT.4.NF.A.1", type: "tag_list", required: true },
  { key: "learningObjective", label: "Learning Objective", placeholder: "Students will be able to (SWBAT)...", type: "text", required: true },
  { key: "essentialQuestion", label: "Essential Question", placeholder: "What question drives this lesson?", type: "text" },
  { key: "academicVocabulary", label: "Academic Vocabulary", placeholder: "Key terms for the lesson", type: "tag_list" },
  { key: "differentiationNotes", label: "Differentiation Notes", placeholder: "ELL, IEP, gifted accommodations", type: "richtext" },
];

const IB_PYP_CURRICULUM_FIELDS: CurriculumMetadataField[] = [
  {
    key: "transdisciplinaryTheme", label: "Transdisciplinary Theme", placeholder: "Select a theme", type: "select", required: true,
    options: [
      { value: "who_we_are", label: "Who We Are" },
      { value: "where_we_are", label: "Where We Are in Place and Time" },
      { value: "how_we_express", label: "How We Express Ourselves" },
      { value: "how_world_works", label: "How the World Works" },
      { value: "how_we_organize", label: "How We Organize Ourselves" },
      { value: "sharing_planet", label: "Sharing the Planet" },
    ],
  },
  { key: "centralIdea", label: "Central Idea", placeholder: "The main concept guiding the unit", type: "text", required: true },
  { key: "linesOfInquiry", label: "Lines of Inquiry", placeholder: "Add a line of inquiry", type: "outcome_list", required: true },
  { key: "keyConcepts", label: "Key Concepts", placeholder: "e.g., Form, Function, Causation", type: "tag_list", required: true },
  { key: "relatedConcepts", label: "Related Concepts", placeholder: "Discipline-specific concepts", type: "tag_list" },
  { key: "learnerProfile", label: "Learner Profile Attributes", placeholder: "e.g., Inquirers, Thinkers", type: "tag_list" },
  { key: "atlSkills", label: "Approaches to Learning (ATL)", placeholder: "e.g., Thinking skills, Communication skills", type: "tag_list" },
  { key: "actionComponent", label: "Action Component", placeholder: "How learners will take action", type: "richtext" },
];

const IB_MYP_CURRICULUM_FIELDS: CurriculumMetadataField[] = [
  {
    key: "subjectGroup", label: "Subject Group", placeholder: "Select a subject group", type: "select", required: true,
    options: [
      { value: "language_acquisition", label: "Language Acquisition" },
      { value: "language_literature", label: "Language & Literature" },
      { value: "individuals_societies", label: "Individuals & Societies" },
      { value: "sciences", label: "Sciences" },
      { value: "mathematics", label: "Mathematics" },
      { value: "arts", label: "Arts" },
      { value: "design", label: "Design" },
      { value: "physical_health", label: "Physical & Health Education" },
    ],
  },
  { key: "keyConcept", label: "Key Concept", placeholder: "e.g., Change, Systems, Relationships", type: "text", required: true },
  { key: "relatedConcepts", label: "Related Concepts", placeholder: "Discipline-grounded concepts", type: "tag_list", required: true },
  {
    key: "globalContext", label: "Global Context", placeholder: "Select a global context", type: "select", required: true,
    options: [
      { value: "identities_relationships", label: "Identities & Relationships" },
      { value: "orientation_space_time", label: "Orientation in Space & Time" },
      { value: "personal_cultural", label: "Personal & Cultural Expression" },
      { value: "scientific_technical", label: "Scientific & Technical Innovation" },
      { value: "globalization_sustainability", label: "Globalization & Sustainability" },
      { value: "fairness_development", label: "Fairness & Development" },
    ],
  },
  { key: "statementOfInquiry", label: "Statement of Inquiry", placeholder: "What we will be learning and why", type: "richtext", required: true },
  { key: "inquiryQuestions", label: "Inquiry Questions (Factual, Conceptual, Debatable)", placeholder: "Add an inquiry question", type: "outcome_list", required: true },
  { key: "atlSkills", label: "Approaches to Learning (ATL)", placeholder: "Specific ATL skills", type: "tag_list" },
  { key: "objectiveStrands", label: "MYP Objective Strands", placeholder: "e.g., Criterion A: Knowing & Understanding", type: "tag_list", required: true },
  { key: "summativeAssessment", label: "Summative Assessment Description", placeholder: "Task description and assessment criteria", type: "richtext" },
];

// ============================================================================
// Shared phase definitions
// ============================================================================

const THREE_PHASE_STARTER: LessonPhase = {
  key: "starter",
  label: "Starter",
  defaultTimeMins: 10,
  fields: [
    { key: "activities", label: "Activities", placeholder: "Describe the opening activities...", type: "richtext", required: true },
    { key: "rpkPrompt", label: "Review of Previous Knowledge", placeholder: "Questions to activate prior knowledge...", type: "richtext" },
    { key: "engagementHook", label: "Engagement Hook", placeholder: "Story, question, game, or demonstration...", type: "richtext" },
  ],
};

const THREE_PHASE_MAIN: LessonPhase = {
  key: "main",
  label: "Main Activity",
  defaultTimeMins: 25,
  fields: [
    { key: "teacherActivities", label: "Teacher Activities", placeholder: "What the teacher does...", type: "richtext", required: true },
    { key: "learnerActivities", label: "Learner Activities", placeholder: "What learners do...", type: "richtext", required: true },
    { key: "resourcesUsed", label: "Resources Used", placeholder: "Materials and resources...", type: "richtext" },
    { key: "embeddedAssessment", label: "Embedded Assessment", placeholder: "How you'll check understanding during the activity...", type: "richtext" },
    { key: "differentiation", label: "Differentiation", placeholder: "Support for different ability levels...", type: "richtext" },
    { key: "groupingStrategy", label: "Grouping Strategy", placeholder: "Individual, pairs, groups...", type: "text" },
  ],
};

const THREE_PHASE_PLENARY: LessonPhase = {
  key: "plenary",
  label: "Plenary / Reflection",
  defaultTimeMins: 5,
  fields: [
    { key: "summaryPoints", label: "Summary Points", placeholder: "Key points to reinforce...", type: "richtext", required: true },
    { key: "learnerReflection", label: "Learner Reflection", placeholder: "How learners reflect on their learning...", type: "richtext" },
    { key: "teacherReflection", label: "Teacher Reflection", placeholder: "Notes for the teacher after the lesson...", type: "richtext" },
    { key: "exitTicket", label: "Exit Ticket", placeholder: "Quick check question...", type: "text" },
    { key: "homework", label: "Homework", placeholder: "Assignment for reinforcement...", type: "richtext" },
  ],
};

// ============================================================================
// IB PYP Unit Planner sections
// ============================================================================

const PYP_UNIT_SECTIONS: UnitPlannerSection[] = [
  {
    key: "overview",
    label: "Unit Overview",
    description: "Set the big picture for this unit of inquiry",
    fields: [
      { key: "unitTitle", label: "Unit Title", placeholder: "Title of the unit of inquiry", type: "text", required: true },
      { key: "duration", label: "Duration (weeks)", placeholder: "e.g., 6", type: "text" },
      { key: "subjectFocus", label: "Subject Focus Areas (2-3)", placeholder: "e.g., Mathematics, Science", type: "tag_list" },
    ],
  },
  {
    key: "planning",
    label: "Planning & Inquiry",
    description: "Design the inquiry journey",
    fields: [
      { key: "priorLearning", label: "Prior Learning & Connections", placeholder: "What do learners already know?", type: "richtext" },
      { key: "teacherQuestions", label: "Teacher Questions", placeholder: "Questions to provoke inquiry...", type: "outcome_list" },
      { key: "studentQuestions", label: "Student Questions", placeholder: "Questions learners might ask...", type: "outcome_list" },
      { key: "learningGoals", label: "Learning Goals", placeholder: "What learners will understand and be able to do", type: "outcome_list", required: true },
    ],
  },
  {
    key: "experiences",
    label: "Learning Experiences",
    description: "Design engaging, inquiry-driven activities",
    fields: [
      { key: "activities", label: "Learning Experiences & Activities", placeholder: "Describe the sequence of learning experiences...", type: "richtext", required: true },
      { key: "studentAgency", label: "Student Agency & Voice", placeholder: "How will learners direct their own learning?", type: "richtext" },
      { key: "assessmentStrategies", label: "Ongoing Assessment Strategies", placeholder: "Formative assessment approaches...", type: "richtext" },
      { key: "selfPeerAssessment", label: "Self & Peer Assessment", placeholder: "How learners assess themselves and each other", type: "richtext" },
    ],
  },
  {
    key: "reflection",
    label: "Reflections",
    description: "Document what happened and what to improve",
    fields: [
      { key: "preReflection", label: "Pre-Unit Reflection", placeholder: "Considerations before starting the unit...", type: "richtext" },
      { key: "ongoingReflections", label: "Ongoing Reflections", placeholder: "Notes captured during the unit...", type: "richtext" },
      { key: "postReflection", label: "Post-Unit Reflection", placeholder: "What worked? What would you change?", type: "richtext" },
      { key: "subjectReflections", label: "Subject-Specific Reflections", placeholder: "Reflections on individual subject areas...", type: "richtext" },
    ],
  },
];

// ============================================================================
// IB MYP Unit Planner sections
// ============================================================================

const MYP_UNIT_SECTIONS: UnitPlannerSection[] = [
  {
    key: "overview",
    label: "Unit Overview",
    description: "Define the conceptual framework",
    fields: [
      { key: "unitTitle", label: "Unit Title", placeholder: "Topic, standard, or engaging title", type: "text", required: true },
      { key: "mypYear", label: "MYP Year", placeholder: "e.g., Year 1, Year 3", type: "text" },
      { key: "durationHours", label: "Duration (hours)", placeholder: "e.g., 20", type: "text" },
    ],
  },
  {
    key: "inquiry",
    label: "Inquiry & Content",
    description: "Content knowledge and teaching strategies",
    fields: [
      { key: "content", label: "Content (Facts, Topics, Terms)", placeholder: "What students need to know...", type: "richtext", required: true },
      { key: "learningExperiences", label: "Learning Experiences & Teaching Strategies", placeholder: "How you will teach this unit...", type: "richtext", required: true },
      { key: "formativeAssessment", label: "Formative Assessment", placeholder: "How you'll check understanding throughout...", type: "richtext" },
      { key: "differentiationStrategies", label: "Differentiation Strategies", placeholder: "Accommodations for diverse learners...", type: "richtext" },
    ],
  },
  {
    key: "resources",
    label: "Resources & Materials",
    fields: [
      { key: "teacherResources", label: "Teacher Resources", placeholder: "Textbooks, websites, materials...", type: "richtext" },
      { key: "studentResources", label: "Student Resources", placeholder: "What students will use...", type: "richtext" },
    ],
  },
  {
    key: "reflection",
    label: "Reflections",
    description: "Document before, during, and after teaching",
    fields: [
      { key: "beforeTeaching", label: "Before Teaching", placeholder: "What questions or concerns do you have?", type: "richtext" },
      { key: "duringTeaching", label: "During Teaching", placeholder: "What observations and adjustments?", type: "richtext" },
      { key: "afterTeaching", label: "After Teaching", placeholder: "What worked? Next steps?", type: "richtext" },
    ],
  },
];

// ============================================================================
// Template definitions per curriculum
// ============================================================================

const NACCA_3_PHASE: LessonTemplateDefinition = {
  id: "NACCA_3_PHASE",
  label: "NaCCA 3-Phase",
  shortLabel: "3-Phase",
  description: "Ghana NaCCA structured lesson with Starter, Main Activity, and Plenary",
  granularity: "daily",
  icon: "book",
  color: "indigo",
  curriculumFields: NACCA_CURRICULUM_FIELDS,
  wizardSteps: [
    { id: "context", label: "Context" },
    { id: "curriculum", label: "Curriculum" },
    { id: "resources", label: "Resources" },
    { id: "body", label: "Lesson Body" },
    { id: "assessment", label: "Assessment" },
    { id: "review", label: "Review" },
  ],
  phases: [THREE_PHASE_STARTER, THREE_PHASE_MAIN, THREE_PHASE_PLENARY],
};

const CLASSIC_JHS: LessonTemplateDefinition = {
  id: "CLASSIC_JHS",
  label: "Classic JHS",
  shortLabel: "Classic",
  description: "Traditional JHS format with objectives, RPK, and presentation steps",
  granularity: "daily",
  icon: "graduation",
  color: "emerald",
  curriculumFields: NACCA_CURRICULUM_FIELDS,
  wizardSteps: [
    { id: "context", label: "Context" },
    { id: "curriculum", label: "Curriculum" },
    { id: "resources", label: "Resources" },
    { id: "body", label: "Lesson Body" },
    { id: "assessment", label: "Assessment" },
    { id: "review", label: "Review" },
  ],
};

const SIMPLE: LessonTemplateDefinition = {
  id: "SIMPLE",
  label: "Quick Note",
  shortLabel: "Quick",
  description: "Simple format for quick lesson planning",
  granularity: "daily",
  icon: "file",
  color: "amber",
  curriculumFields: [
    { key: "learningObjective", label: "Learning Objective", placeholder: "What learners will achieve...", type: "text" },
    { key: "learningOutcomes", label: "Learning Outcomes", placeholder: "Learners will be able to...", type: "outcome_list" },
  ],
  wizardSteps: [
    { id: "context", label: "Context" },
    { id: "body", label: "Lesson Body" },
    { id: "review", label: "Review" },
  ],
};

const CAMBRIDGE_3_PART: LessonTemplateDefinition = {
  id: "CAMBRIDGE_3_PART",
  label: "Cambridge 3-Part Lesson",
  shortLabel: "Cambridge",
  description: "Cambridge International structured lesson with Starter, Main, and Reflection",
  granularity: "daily",
  icon: "globe",
  color: "blue",
  curriculumFields: CAMBRIDGE_CURRICULUM_FIELDS,
  wizardSteps: [
    { id: "context", label: "Context" },
    { id: "curriculum", label: "Learning Objectives" },
    { id: "resources", label: "Resources" },
    { id: "body", label: "Lesson Body" },
    { id: "assessment", label: "Assessment" },
    { id: "review", label: "Review" },
  ],
  phases: [
    { ...THREE_PHASE_STARTER, label: "Starter / Hook" },
    {
      ...THREE_PHASE_MAIN,
      label: "Main Activities",
      fields: [
        ...THREE_PHASE_MAIN.fields,
        { key: "languageSupport", label: "Language Support", placeholder: "Scaffolding for language barriers...", type: "richtext" },
      ],
    },
    { ...THREE_PHASE_PLENARY, label: "Reflection & Plenary" },
  ],
};

const BRITISH_3_PART: LessonTemplateDefinition = {
  id: "BRITISH_3_PART",
  label: "British NC Lesson Plan",
  shortLabel: "British",
  description: "Flexible lesson plan following the British three-part structure",
  granularity: "daily",
  icon: "flag",
  color: "rose",
  curriculumFields: BRITISH_CURRICULUM_FIELDS,
  wizardSteps: [
    { id: "context", label: "Context" },
    { id: "curriculum", label: "Objectives & NC Ref" },
    { id: "resources", label: "Resources" },
    { id: "body", label: "Lesson Body" },
    { id: "assessment", label: "Assessment" },
    { id: "review", label: "Review" },
  ],
  phases: [
    { ...THREE_PHASE_STARTER, label: "Starter" },
    THREE_PHASE_MAIN,
    { ...THREE_PHASE_PLENARY, label: "Plenary" },
  ],
};

const AMERICAN_STANDARDS: LessonTemplateDefinition = {
  id: "AMERICAN_STANDARDS",
  label: "Standards-Based Lesson Plan",
  shortLabel: "American",
  description: "CCSS-aligned lesson plan with objectives, instruction, and assessment",
  granularity: "daily",
  icon: "flag",
  color: "cyan",
  curriculumFields: AMERICAN_CURRICULUM_FIELDS,
  wizardSteps: [
    { id: "context", label: "Context" },
    { id: "curriculum", label: "Standards & Objectives" },
    { id: "resources", label: "Resources" },
    { id: "body", label: "Lesson Body" },
    { id: "assessment", label: "Assessment" },
    { id: "review", label: "Review" },
  ],
  phases: [
    {
      key: "opening",
      label: "Opening / Bell Work",
      defaultTimeMins: 10,
      fields: [
        { key: "activities", label: "Opening Activity / Bell Work", placeholder: "Warm-up or do-now activity...", type: "richtext", required: true },
        { key: "rpkPrompt", label: "Prior Knowledge Activation", placeholder: "Connect to previous learning...", type: "richtext" },
        { key: "engagementHook", label: "Hook / Essential Question", placeholder: "Engaging question or scenario...", type: "richtext" },
      ],
    },
    {
      key: "instruction",
      label: "Direct Instruction & Guided Practice",
      defaultTimeMins: 25,
      fields: [
        { key: "teacherActivities", label: "Direct Instruction (I Do)", placeholder: "Teacher modeling and explanation...", type: "richtext", required: true },
        { key: "learnerActivities", label: "Guided Practice (We Do)", placeholder: "Collaborative practice...", type: "richtext", required: true },
        { key: "independentPractice", label: "Independent Practice (You Do)", placeholder: "Students work independently...", type: "richtext" },
        { key: "resourcesUsed", label: "Materials Used", placeholder: "Technology, manipulatives, texts...", type: "richtext" },
        { key: "differentiation", label: "Differentiation / Accommodations", placeholder: "ELL, IEP, gifted...", type: "richtext" },
      ],
    },
    {
      key: "closing",
      label: "Closing / Exit Ticket",
      defaultTimeMins: 5,
      fields: [
        { key: "summaryPoints", label: "Closing Activity", placeholder: "Summarize key learning...", type: "richtext", required: true },
        { key: "exitTicket", label: "Exit Ticket / Assessment", placeholder: "Quick formative check...", type: "text" },
        { key: "homework", label: "Homework / Extension", placeholder: "Practice or extension activity...", type: "richtext" },
      ],
    },
  ],
};

const IB_PYP_UNIT_PLANNER: LessonTemplateDefinition = {
  id: "IB_PYP_UNIT_PLANNER",
  label: "IB PYP Unit of Inquiry Planner",
  shortLabel: "PYP Planner",
  description: "Multi-week inquiry-based unit planner for the IB Primary Years Programme",
  granularity: "unit",
  icon: "compass",
  color: "violet",
  curriculumFields: IB_PYP_CURRICULUM_FIELDS,
  wizardSteps: [
    { id: "context", label: "Unit Context" },
    { id: "curriculum", label: "Inquiry Framework" },
    { id: "overview", label: "Unit Overview" },
    { id: "planning", label: "Planning" },
    { id: "experiences", label: "Learning Experiences" },
    { id: "resources", label: "Resources" },
    { id: "reflection", label: "Reflections" },
    { id: "review", label: "Review" },
  ],
  unitSections: PYP_UNIT_SECTIONS,
};

const IB_MYP_UNIT_PLANNER: LessonTemplateDefinition = {
  id: "IB_MYP_UNIT_PLANNER",
  label: "IB MYP Unit Planner",
  shortLabel: "MYP Planner",
  description: "Concept-driven, criterion-based unit planner for the IB Middle Years Programme",
  granularity: "unit",
  icon: "layers",
  color: "violet",
  curriculumFields: IB_MYP_CURRICULUM_FIELDS,
  wizardSteps: [
    { id: "context", label: "Unit Context" },
    { id: "curriculum", label: "Conceptual Framework" },
    { id: "overview", label: "Unit Overview" },
    { id: "inquiry", label: "Inquiry & Content" },
    { id: "resources", label: "Resources & Materials" },
    { id: "reflection", label: "Reflections" },
    { id: "review", label: "Review" },
  ],
  unitSections: MYP_UNIT_SECTIONS,
};

// ============================================================================
// Mapping: CurriculumCode → available templates
// ============================================================================

export const CURRICULUM_LESSON_TEMPLATES: Record<CurriculumCode, LessonTemplateDefinition[]> = {
  ghana_nacca: [NACCA_3_PHASE, CLASSIC_JHS, SIMPLE],
  cambridge: [CAMBRIDGE_3_PART, SIMPLE],
  ib_pyp: [IB_PYP_UNIT_PLANNER, SIMPLE],
  ib_myp: [IB_MYP_UNIT_PLANNER, SIMPLE],
  british_nc: [BRITISH_3_PART, SIMPLE],
  american: [AMERICAN_STANDARDS, SIMPLE],
  hybrid: [NACCA_3_PHASE, CAMBRIDGE_3_PART, BRITISH_3_PART, AMERICAN_STANDARDS, CLASSIC_JHS, IB_PYP_UNIT_PLANNER, IB_MYP_UNIT_PLANNER, SIMPLE],
};

// ============================================================================
// Utilities
// ============================================================================

export function getTemplatesForCurriculum(code: CurriculumCode): LessonTemplateDefinition[] {
  return CURRICULUM_LESSON_TEMPLATES[code] || CURRICULUM_LESSON_TEMPLATES.ghana_nacca;
}

export function getTemplateDefinition(templateType: LessonTemplateType): LessonTemplateDefinition | undefined {
  const all = Object.values(CURRICULUM_LESSON_TEMPLATES).flat();
  return all.find((t) => t.id === templateType);
}

export function getDefaultTemplate(code: CurriculumCode): LessonTemplateDefinition {
  const templates = getTemplatesForCurriculum(code);
  return templates[0];
}

export function isDailyTemplate(templateType: LessonTemplateType): boolean {
  const def = getTemplateDefinition(templateType);
  return def?.granularity === "daily";
}

export function isUnitPlannerTemplate(templateType: LessonTemplateType): boolean {
  const def = getTemplateDefinition(templateType);
  return def?.granularity === "unit";
}
