import { z } from "zod";
import OpenAI from "openai";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { enforceSchoolLimit } from "@/lib/auth/checkLimit";
import { trackUsage } from "@/lib/billing/trackUsage";
import { PERMISSIONS } from "@/lib/rbac";
import { getTemplateDefinition } from "@/constants/curriculum-lesson-templates";

const GenerateRequestSchema = z.object({
  action: z.enum([
    "refine_context",
    "suggest_field_values",
    "suggest_resources",
    "generate_body",
    "generate_assessment_section",
    "expand_section",
    "suggest_activities",
    "improve_content",
    "generate_assessment",
    "generate_objectives",
  ]),
  templateType: z.enum([
    "NACCA_3_PHASE",
    "CLASSIC_JHS",
    "SIMPLE",
    "CAMBRIDGE_3_PART",
    "BRITISH_3_PART",
    "AMERICAN_STANDARDS",
    "IB_PYP_UNIT_PLANNER",
    "IB_MYP_UNIT_PLANNER",
  ]),
  gradeLevel: z.string().max(50).optional(),
  subject: z.string().max(100).optional(),
  topic: z.string().min(1).max(200),
  duration: z.number().min(5).max(180).optional(),
  strand: z.string().max(200).optional(),
  subStrand: z.string().max(200).optional(),
  contentStandard: z.string().max(500).optional(),
  indicators: z.array(z.string().max(200)).optional(),
  section: z.string().max(100).optional(),
  existingContent: z.string().max(6000).optional(),
  learnerBackground: z.string().max(500).optional(),
  classSize: z.number().min(1).max(100).optional(),
  teacherIntent: z.string().max(600).optional(),
  contextSummary: z.string().max(6000).optional(),
  fieldBlueprint: z
    .array(
      z.object({
        key: z.string().max(120),
        label: z.string().max(120),
        type: z.enum([
          "text",
          "richtext",
          "indicator_list",
          "outcome_list",
          "tag_list",
          "select",
        ]),
        required: z.boolean().optional(),
        options: z
          .array(
            z.object({
              value: z.string().max(100),
              label: z.string().max(120),
            })
          )
          .optional(),
      })
    )
    .max(40)
    .optional(),
});

type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

function buildSystemPrompt(templateType: string, action: string): string {
  const basePrompt = `You are an experienced curriculum-aware teacher helping to create high-quality lesson notes for Ghanaian schools.
Your responses should:
- stay tightly scoped to the requested section only
- be practical, classroom-ready, and teacher-friendly
- use clear professional language appropriate for the grade level
- respect the selected curriculum or lesson-planning template
- avoid inventing facts when the context is thin
- use Ghana-appropriate examples and contexts where helpful
- never use abusive, demeaning, frightening, or discouraging language

Always respond with valid JSON only, no markdown formatting.`;

  const isDeepAction = action === "generate_body" || action === "generate_assessment_section";

  if (templateType === "NACCA_3_PHASE") {
    const phaseGuidance = isDeepAction
      ? `
Deep content rules for NaCCA 3-phase body:
STARTER (5–10 min): Activate relevant prior knowledge with a direct question or quick activity. State the learning target in plain learner language ("By the end of today, you will be able to…"). Do not simply re-read the topic.
MAIN (20–30 min): Build concepts using a concrete → abstract → practice sequence. Include:
  - At least one clearly explained, step-by-step worked example with commentary
  - A second example or variation for longer sessions (>35 min)
  - Named common misconceptions with specific, supportive correction wording
  - Guided practice with expected answers or solution notes
  - Teacher questioning prompts that probe understanding beyond recall
PLENARY (5–10 min): Formative check (quick questions or exit-ticket style task) + brief summary that connects to the next lesson.
Each phase must include timeMins. Rich-text fields use HTML (<p>, <ul>, <li>, <strong>, <em>).`
      : "";
    return `${basePrompt}

This lesson uses the NaCCA 3-phase structure: starter, main activity, plenary.${phaseGuidance}`;
  }

  if (templateType === "CLASSIC_JHS") {
    const stepGuidance = isDeepAction
      ? `
Deep content rules for Classic JHS body:
OBJECTIVES: Write one general objective and 3–5 specific, measurable objectives aligned to the curriculum indicators.
RPK: Identify the exact prior knowledge learners must hold. Phrase it as what learners already know or can do.
INTRODUCTION: A concrete motivating hook — real-world question, diagram, or short story — that makes the topic relevant before any formal definition.
PRESENTATION STEPS: Each step must have teacherActivity, learnerActivity, boardWork, keyQuestions, and timeMins.
  - teacherActivity: explain the concept clearly with at least one worked example per step. Include step-by-step reasoning, not just instructions.
  - learnerActivity: a guided or independent practice task with expected output
  - keyQuestions: at least two questions per step — one recall, one application
  - boardWork: exact text, worked examples, or diagrams to write on the board
CORE POINTS: 4–6 key facts or rules learners must remember, stated concisely.
EVALUATION: Include 3–5 specific evaluation questions with model answers and marking notes.`
      : "";
    return `${basePrompt}

This lesson uses the Classic JHS structure: objectives, relevant previous knowledge, introduction, presentation steps, core points, evaluation, remarks.${stepGuidance}`;
  }

  if (templateType === "SIMPLE") {
    const simpleGuidance = isDeepAction
      ? `
Deep content rules for Simple body:
- objectives: clear, measurable, stated in learner language
- content: must include (a) a definition or concept explanation, (b) at least one worked example with step-by-step reasoning, (c) a common misconception callout, (d) a practice activity with expected answers.
Use HTML for rich formatting.`
      : "";
    return `${basePrompt}

This is a quick/simple lesson note.${simpleGuidance}`;
  }

  return basePrompt;
}

function buildContextBlock(data: GenerateRequest): string {
  const parts = [
    `Topic: ${data.topic}`,
    data.subject && `Subject: ${data.subject}`,
    data.gradeLevel && `Grade Level: ${data.gradeLevel}`,
    data.duration && `Duration: ${data.duration} minutes`,
    data.classSize && `Class Size: ${data.classSize} students`,
    data.learnerBackground && `Learner Background: ${data.learnerBackground}`,
    data.strand && `Strand: ${data.strand}`,
    data.subStrand && `Sub-strand: ${data.subStrand}`,
    data.contentStandard && `Content Standard: ${data.contentStandard}`,
    data.indicators?.length && `Indicators: ${data.indicators.join(", ")}`,
    data.teacherIntent && `Teacher Request: ${data.teacherIntent}`,
  ]
    .filter(Boolean)
    .join("\n");

  if (!data.contextSummary) {
    return parts;
  }

  return `${parts}

Earlier completed lesson context:
${data.contextSummary}`;
}

function buildRefineContextPrompt(data: GenerateRequest): string {
  return `Refine the context details for this lesson note without generating curriculum, resources, body, or assessment content.

${buildContextBlock(data)}

Respond with:
{
  "topic": "A clearer, teacher-friendly topic title",
  "reference": "Optional reference or textbook suggestion",
  "durationMinutes": 40,
  "rationale": "Short explanation"
}`;
}

function buildSuggestFieldValuesPrompt(data: GenerateRequest): string {
  const fields = data.fieldBlueprint || [];
  const fieldSpec = fields
    .map((field) => {
      const options =
        field.type === "select" && field.options?.length
          ? ` Allowed values: ${field.options.map((opt) => opt.value).join(", ")}.`
          : "";
      return `- ${field.key}: ${field.label} (${field.type})${field.required ? " [required]" : ""}.${options}`;
    })
    .join("\n");

  return `Help complete the "${data.section || "current"}" section of a lesson note.

${buildContextBlock(data)}

Fill only these fields:
${fieldSpec}

Respond with:
{
  "fieldSuggestions": {
    "fieldKey": "value"
  }
}

Rules:
- Only include keys from the provided list.
- For "text" fields return a plain string.
- For "richtext" fields return HTML using <p>, <ul>, and <li> where useful.
- For "outcome_list" and "tag_list" return arrays of strings.
- For "indicator_list" return an array of objects with "refNo" and "text".
- For "select" return one allowed value exactly.`;
}

function buildSuggestResourcesPrompt(data: GenerateRequest): string {
  return `Suggest realistic teaching materials and resource ideas for this lesson note.

${buildContextBlock(data)}

Current resources snapshot:
${data.existingContent || "None yet"}

Respond with:
{
  "tlms": ["Teaching and learning material"],
  "resources": [
    {
      "title": "Resource title",
      "type": "link|pdf|video|image|doc|slides|other"
    }
  ]
}

Rules:
- Keep the suggestions classroom-realistic.
- Do not invent external URLs.
- Limit yourself to resources and materials only.`;
}

function buildBodyPrompt(data: GenerateRequest): string {
  const contextBlock = buildContextBlock(data);
  const currentDraft = data.existingContent
    ? `Current body draft to improve upon:\n${data.existingContent}\n\n`
    : "";

  if (data.templateType === "CLASSIC_JHS") {
    return `Generate a thorough, classroom-ready lesson BODY for this Classic JHS note.

${contextBlock}

${currentDraft}Respond with:
{
  "body": {
    "objectives": {
      "general": "One overarching objective aligned to the content standard",
      "specific": ["3-5 measurable specific objectives using action verbs (identify, explain, calculate, demonstrate, etc.)"]
    },
    "rpk": "<p>Exactly what learners already know that this lesson builds on. Be specific — name the prior topic or skill.</p>",
    "introduction": "<p>A concrete motivating hook: a real-world question, brief scenario, or familiar context that makes the topic relevant before any formal definition.</p>",
    "presentationSteps": [
      {
        "stepTitle": "Step title (e.g. Concept Introduction, Worked Example, Guided Practice)",
        "teacherActivity": "<p>Detailed teacher explanation including at least one fully worked example with step-by-step reasoning. For Mathematics include concrete numbers and full solution. Name any common misconceptions and show supportive correction.</p>",
        "learnerActivity": "<p>Specific task learners complete — individual, pair, or group. State the expected output or answer.</p>",
        "boardWork": "Exact text, diagram labels, or worked solution to write on the board",
        "keyQuestions": ["One recall question", "One application question that probes deeper understanding"],
        "timeMins": 10
      }
    ],
    "corePoints": ["4-6 key facts or rules stated concisely — what learners must remember"],
    "evaluation": {
      "questions": ["3-5 specific evaluation questions"],
      "answers": ["Corresponding model answers"],
      "markingNotes": "Guidance for marking or common errors to watch for"
    },
    "remarks": ""
  }
}

Rules:
- Use HTML (<p>, <ul>, <li>, <strong>, <em>) for rich-text fields.
- Include at least 2 presentation steps for a 40-minute lesson; 3 steps for longer.
- Each step's teacherActivity must explain the concept, not just list tasks.
- Do not use placeholder text — generate real, subject-specific content.`;
  }

  if (data.templateType === "SIMPLE") {
    return `Generate a thorough lesson BODY for this quick note.

${contextBlock}

${currentDraft}Respond with:
{
  "body": {
    "objectives": "<p>Clear learning objectives in learner language — what students will be able to do after this lesson.</p>",
    "content": "<p>[Definition/concept explanation]</p><p>[Worked example with step-by-step reasoning]</p><p>[Common misconception and supportive correction]</p><p>[Practice activity with expected answers]</p>"
  }
}

Rules:
- Use HTML for both fields.
- The content field must include a definition/concept, a worked example, a misconception note, and a practice activity.
- Do not use placeholder headings — write real content.`;
  }

  const templateDef = getTemplateDefinition(data.templateType);
  const phases = templateDef?.phases || [];
  const phaseKeys = ["starter", "main", "plenary"] as const;
  const phaseSkeleton = phases
    .slice(0, phaseKeys.length)
    .map((phase, index) => {
      const fields = phase.fields
        .map((field) => {
          if (field.type === "number") {
            return `      "${field.key}": ${phase.defaultTimeMins}`;
          }
          return `      "${field.key}": "${field.label}"`;
        })
        .join(",\n");
      return `    "${phaseKeys[index]}": {\n${fields},\n      "timeMins": ${phase.defaultTimeMins}\n    }`;
    })
    .join(",\n");

  const phaseGuidanceForNaCCA = data.templateType === "NACCA_3_PHASE"
    ? `

Teaching sequence guidance:
- starter: Activate prior knowledge with a direct question or quick activity. State the learning target in learner language. Do not simply re-read the topic title.
- main: Concrete → abstract → practice. Include at least one fully worked example with commentary. Name common misconceptions and give supportive corrections. Include guided practice questions with expected answers.
- plenary: Formative check (2-3 quick questions or exit task) + brief summary connecting to the next lesson.`
    : "";

  return `Generate a thorough, classroom-ready lesson BODY for this note.

${contextBlock}

${currentDraft}Respond with:
{
  "body": {
${phaseSkeleton}
  }
}${phaseGuidanceForNaCCA}

Rules:
- Use HTML (<p>, <ul>, <li>, <strong>, <em>) for rich-text fields.
- Fill every field with real, subject-specific content — no placeholder text.
- Include worked examples, specific questions, and clear teacher guidance.`;
}

function buildAssessmentSectionPrompt(data: GenerateRequest): string {
  return `Generate a thorough, indicator-grounded assessment section for this lesson note.

${buildContextBlock(data)}

Current assessment draft:
${data.existingContent || "None yet"}

Respond with:
{
  "inClassChecks": [
    "2-3 specific formative check questions to ask during the lesson — tied to the indicators, not generic"
  ],
  "exitTicket": "A focused exit-ticket task (1-2 questions) that reveals whether learners met the learning target. Include the expected correct answer in parentheses.",
  "homework": "<p>A specific homework task tied to today's indicators. For skills subjects include practice problems with expected answers. For knowledge subjects include a short response or application task. State clearly what learners should produce.</p>",
  "learnerReflection": "<p>2 reflection prompts for learners: one about what they learned, one about a question they still have or something they want to explore further.</p>",
  "teacherReflection": "<p>2 reflection prompts for the teacher: one about what worked well and what to adjust, one about which learners need follow-up support based on today's evidence.</p>",
  "nextLessonLink": "One sentence: what prior knowledge from today's lesson will the next lesson build on?"
}

Rules:
- inClassChecks must be specific questions, not instructions like "observe learners".
- exitTicket must name the topic and include what correct looks like.
- homework must go beyond "read pages X-Y" — assign a task with a measurable output.
- Do not use placeholder wording.`;
}

function buildExpandSectionPrompt(data: GenerateRequest): string {
  return `Expand and improve the following section of a lesson note.

${buildContextBlock(data)}
Section: ${data.section || "General"}

Current content:
${data.existingContent || "(Empty - generate fresh content)"}

Respond with:
{
  "expandedContent": "Expanded content (HTML formatted)",
  "suggestions": ["Optional improvement suggestion"]
}`;
}

function buildSuggestActivitiesPrompt(data: GenerateRequest): string {
  return `Suggest engaging classroom activities for this lesson note.

${buildContextBlock(data)}
Section: ${data.section || "General"}

Respond with:
{
  "activities": [
    {
      "name": "Activity name",
      "description": "How to run it",
      "duration": "Estimated time",
      "materials": ["Material"],
      "groupSize": "Whole class|Pairs|Small groups|Individual",
      "objectives": "Why this activity helps"
    }
  ]
}`;
}

function buildGenerateAssessmentPrompt(data: GenerateRequest): string {
  return `Generate assessment items for this lesson.

${buildContextBlock(data)}

Lesson content summary:
${data.existingContent || "No summary provided"}

Respond with:
{
  "exitTicket": "Quick end-of-lesson check",
  "evaluationQuestions": [
    {
      "question": "The question",
      "type": "multiple-choice|short-answer|true-false|fill-in-blank",
      "answer": "Correct answer",
      "difficulty": "easy|medium|hard"
    }
  ],
  "homeworkSuggestions": ["Homework suggestion"],
  "embeddedChecks": ["Question to ask during the lesson"]
}`;
}

function buildGenerateObjectivesPrompt(data: GenerateRequest): string {
  return `Generate learning objectives for this lesson.

${buildContextBlock(data)}

Respond with:
{
  "generalObjective": "One overarching objective",
  "specificObjectives": [
    "3-5 measurable specific objectives"
  ],
  "learningOutcomes": [
    "Expected learning outcome"
  ]
}`;
}

function buildImproveContentPrompt(data: GenerateRequest): string {
  return `Improve the following lesson content.

${buildContextBlock(data)}
Section: ${data.section || "General"}

Current content:
${data.existingContent || "(No content provided)"}

Respond with:
{
  "improvedContent": "Improved content (HTML formatted)",
  "changes": ["Improvement made"],
  "suggestions": ["Optional suggestion"]
}`;
}

export async function POST(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    // New subscription gate (no-op while SUBSCRIPTION_API_GATES_ENABLED=false)
    const { requireSchoolFeature } = await import("@/lib/subscriptions/guards");
    const { FEATURE_KEYS } = await import("@/lib/subscriptions/feature-keys");
    const aiGate = await requireSchoolFeature(context.schoolId, FEATURE_KEYS.AI_LESSON_GENERATION);
    if (!aiGate.allowed) {
      return Response.json({ success: false, error: (aiGate as any).reason }, { status: (aiGate as any).statusCode ?? 403 });
    }

    // Reserve Leo credit before calling AI (reserve/finalize/refund pattern)
    const { reserveUsageCredits, finalizeUsageCredits, refundUsageCredits } = await import(
      "@/lib/subscriptions/usage-tracker"
    );
    const { ok: reserveOk, reservation, reason: reserveReason } = await reserveUsageCredits(
      context.schoolId,
      "leo_credits",
      1,
      "Leo AI lesson generation"
    );
    if (!reserveOk || !reservation) {
      return Response.json({ success: false, error: reserveReason ?? "Insufficient Leo AI credits." }, { status: 429 });
    }

    await enforceSchoolLimit({
      schoolId: context.schoolId,
      limitKey: "maxAICallsPerMonth",
      expensive: true,
      message: "The monthly AI generation limit has been reached for this school.",
    });

    if (!can(context.permissions, PERMISSIONS.journalWrite)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { success: false, error: "AI service not configured" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = GenerateRequestSchema.safeParse(body);
    if (!parsed.success) {
      const errorMessages =
        parsed.error.issues?.map((issue) => issue.message).join(", ") ||
        "Invalid data";
      return Response.json(
        { success: false, error: `Validation failed: ${errorMessages}` },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Deep content actions use gpt-4o for richer, more structured output.
    const deepActions = new Set(["generate_body", "generate_assessment_section"]);
    const useDeepModel = deepActions.has(data.action);
    const modelToUse = useDeepModel ? "gpt-4o" : "gpt-4o-mini";
    const maxTokensForAction = useDeepModel ? 6000 : 4000;

    const systemPrompt = buildSystemPrompt(data.templateType, data.action);
    let userPrompt: string;

    switch (data.action) {
      case "refine_context":
        userPrompt = buildRefineContextPrompt(data);
        break;
      case "suggest_field_values":
        userPrompt = buildSuggestFieldValuesPrompt(data);
        break;
      case "suggest_resources":
        userPrompt = buildSuggestResourcesPrompt(data);
        break;
      case "generate_body":
        userPrompt = buildBodyPrompt(data);
        break;
      case "generate_assessment_section":
        userPrompt = buildAssessmentSectionPrompt(data);
        break;
      case "expand_section":
        userPrompt = buildExpandSectionPrompt(data);
        break;
      case "suggest_activities":
        userPrompt = buildSuggestActivitiesPrompt(data);
        break;
      case "generate_assessment":
        userPrompt = buildGenerateAssessmentPrompt(data);
        break;
      case "generate_objectives":
        userPrompt = buildGenerateObjectivesPrompt(data);
        break;
      case "improve_content":
        userPrompt = buildImproveContentPrompt(data);
        break;
      default:
        return Response.json(
          { success: false, error: "Unknown action" },
          { status: 400 }
        );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: modelToUse,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: useDeepModel ? 0.6 : 0.7,
      response_format: { type: "json_object" },
      max_tokens: maxTokensForAction,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error("No response from AI service");
    }

    let aiResponse;
    try {
      aiResponse = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[0]);
      } else {
        // Refund credits — AI returned unparseable output
        await refundUsageCredits(reservation, "AI response parse failure").catch(() => {});
        throw new Error("Failed to parse AI response");
      }
    }

    // Finalize credit usage after successful generation
    await finalizeUsageCredits(reservation, 1).catch(() => {});

    await trackUsage({
      schoolId: context.schoolId,
      provider: "openai",
      metricKey: "ai_calls",
      quantity: 1,
      unitLabel: "calls",
      allocationMethod: "direct",
      sourceType: "manual",
      notes: "Teacher lesson-notes AI generation request.",
    });
    await trackUsage({
      schoolId: context.schoolId,
      provider: "openai",
      metricKey: "total_tokens",
      quantity: Math.max(0, Number(completion.usage?.total_tokens || 0)),
      unitLabel: "tokens",
      allocationMethod: "direct",
      sourceType: "manual",
      notes: "Teacher lesson-notes AI token usage.",
    });

    return Response.json({
      success: true,
      data: aiResponse,
      usage: {
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("AI generation error:", e);
    const message = e instanceof Error ? e.message : "AI generation failed";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

