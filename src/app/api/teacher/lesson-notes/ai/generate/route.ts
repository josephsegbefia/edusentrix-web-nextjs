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

function buildSystemPrompt(templateType: string): string {
  const basePrompt = `You are an experienced curriculum-aware teacher helping to create high-quality lesson notes.
Your responses should:
- stay tightly scoped to the requested section only
- be practical, classroom-ready, and teacher-friendly
- use clear professional language
- respect the selected curriculum or lesson-planning template
- avoid inventing facts when the context is thin

Always respond with valid JSON only, no markdown formatting.`;

  if (templateType === "NACCA_3_PHASE") {
    return `${basePrompt}

This lesson uses the NaCCA 3-phase structure:
- starter
- main activity
- plenary`;
  }

  if (templateType === "CLASSIC_JHS") {
    return `${basePrompt}

This lesson uses the Classic JHS structure:
- objectives
- relevant previous knowledge
- introduction
- presentation steps
- core points
- evaluation
- remarks`;
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
    ? `Current body draft summary:\n${data.existingContent}\n\n`
    : "";

  if (data.templateType === "CLASSIC_JHS") {
    return `Generate only the lesson BODY for this Classic JHS note.

${contextBlock}

${currentDraft}Respond with:
{
  "body": {
    "objectives": {
      "general": "General objective",
      "specific": ["Specific objective"]
    },
    "rpk": "Relevant previous knowledge (HTML formatted)",
    "introduction": "Lesson introduction (HTML formatted)",
    "presentationSteps": [
      {
        "stepTitle": "Step title",
        "teacherActivity": "Teacher activity (HTML formatted)",
        "learnerActivity": "Learner activity (HTML formatted)",
        "boardWork": "Board work",
        "keyQuestions": ["Question"],
        "timeMins": 10
      }
    ],
    "corePoints": ["Key point"],
    "evaluation": {
      "questions": ["Question"],
      "answers": ["Answer"],
      "markingNotes": "Marking notes"
    },
    "remarks": "Optional remarks placeholder"
  }
}`;
  }

  if (data.templateType === "SIMPLE") {
    return `Generate only the lesson BODY for this quick note.

${contextBlock}

${currentDraft}Respond with:
{
  "body": {
    "objectives": "Learning objectives (HTML formatted)",
    "content": "Lesson content and activities (HTML formatted)"
  }
}`;
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

  return `Generate only the lesson BODY for this note.

${contextBlock}

${currentDraft}Respond with:
{
  "body": {
${phaseSkeleton}
  }
}

Rules:
- Use HTML for rich-text fields.
- Keep the response limited to the body structure only.`;
}

function buildAssessmentSectionPrompt(data: GenerateRequest): string {
  return `Generate only the assessment and reflection fields for this lesson note.

${buildContextBlock(data)}

Current assessment draft:
${data.existingContent || "None yet"}

Respond with:
{
  "inClassChecks": ["Short formative check"],
  "exitTicket": "Short exit ticket prompt",
  "homework": "Homework or follow-up task (HTML formatted)",
  "learnerReflection": "Learner reflection prompt (HTML formatted)",
  "teacherReflection": "Teacher reflection prompt (HTML formatted)",
  "nextLessonLink": "How this lesson connects to the next one"
}`;
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
    await enforceSchoolLimit({
      schoolId: context.schoolId,
      limitKey: "maxAICallsPerMonth",
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
    const systemPrompt = buildSystemPrompt(data.templateType);
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
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
      max_tokens: 4000,
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
        throw new Error("Failed to parse AI response");
      }
    }

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
