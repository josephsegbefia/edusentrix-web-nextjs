import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import OpenAI from "openai";

// ============================================================================
// Validation Schema
// ============================================================================

const GenerateRequestSchema = z.object({
  // What to generate
  action: z.enum([
    "full_lesson", // Generate a complete lesson note
    "expand_section", // Expand a specific section
    "suggest_activities", // Suggest activities for a phase
    "improve_content", // Improve existing content
    "generate_assessment", // Generate assessment questions
    "generate_objectives", // Generate objectives from topic
  ]),

  // Context
  templateType: z.enum(["NACCA_3_PHASE", "CLASSIC_JHS", "SIMPLE"]),
  gradeLevel: z.string().max(50).optional(),
  subject: z.string().max(100).optional(),
  topic: z.string().min(1).max(200),
  duration: z.number().min(5).max(180).optional(),

  // Curriculum alignment
  strand: z.string().max(200).optional(),
  subStrand: z.string().max(200).optional(),
  contentStandard: z.string().max(500).optional(),
  indicators: z.array(z.string().max(200)).optional(),

  // Section-specific context for expand/improve
  section: z.string().max(100).optional(),
  existingContent: z.string().max(4000).optional(),

  // Additional context
  learnerBackground: z.string().max(500).optional(),
  classSize: z.number().min(1).max(100).optional(),
});

type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

// ============================================================================
// Prompt Templates
// ============================================================================

function buildSystemPrompt(templateType: string): string {
  const basePrompt = `You are an experienced Ghanaian teacher and curriculum specialist helping to create high-quality lesson notes. 
Your responses should:
- Be aligned with the Ghana Education Service (GES) standards
- Follow the NaCCA curriculum framework where applicable
- Use clear, professional language appropriate for educators
- Be practical and classroom-ready
- Include specific, actionable activities

Always respond with valid JSON only, no markdown formatting.`;

  if (templateType === "NACCA_3_PHASE") {
    return `${basePrompt}

You are specifically creating content for the NaCCA 3-Phase lesson format:
- STARTER: Engagement hook, RPK activation, setting expectations (5-10 mins)
- MAIN: Teacher and learner activities, embedded assessment, differentiation (25-40 mins)
- PLENARY: Summary, reflection, homework assignment (5-10 mins)`;
  }

  if (templateType === "CLASSIC_JHS") {
    return `${basePrompt}

You are specifically creating content for the Classic JHS lesson format:
- General and Specific Objectives (using behavioral verbs)
- Relevant Previous Knowledge (RPK)
- Introduction
- Presentation Steps (teacher and learner activities)
- Core Points
- Evaluation Questions
- Remarks`;
  }

  return basePrompt;
}

function buildFullLessonPrompt(data: GenerateRequest): string {
  const { templateType, topic, subject, gradeLevel, duration, strand, subStrand, contentStandard, indicators, learnerBackground, classSize } = data;

  const contextParts = [
    `Topic: ${topic}`,
    subject && `Subject: ${subject}`,
    gradeLevel && `Grade Level: ${gradeLevel}`,
    duration && `Duration: ${duration} minutes`,
    classSize && `Class Size: ${classSize} students`,
    learnerBackground && `Learner Context: ${learnerBackground}`,
    strand && `Strand: ${strand}`,
    subStrand && `Sub-strand: ${subStrand}`,
    contentStandard && `Content Standard: ${contentStandard}`,
    indicators?.length && `Indicators: ${indicators.join(", ")}`,
  ].filter(Boolean).join("\n");

  if (templateType === "NACCA_3_PHASE") {
    return `Generate a complete NaCCA 3-Phase lesson note for:

${contextParts}

Respond with this JSON structure:
{
  "starter": {
    "activities": "Detailed starter activities (HTML formatted with <p>, <ul>, <li>)",
    "rpkPrompt": "Questions to activate prior knowledge",
    "engagementHook": "Engaging opening activity or question",
    "timeMins": 10
  },
  "main": {
    "teacherActivities": "Detailed teacher activities (HTML formatted)",
    "learnerActivities": "Detailed learner activities (HTML formatted)",
    "resourcesUsed": "List of resources/TLMs to use",
    "embeddedAssessment": "How to check understanding during lesson",
    "differentiation": "Strategies for different learner levels",
    "groupingStrategy": "Suggested grouping approach",
    "timeMins": 30
  },
  "plenary": {
    "summaryPoints": "Key points to summarize (HTML formatted)",
    "learnerReflection": "Questions for learner reflection",
    "teacherReflection": "Notes for teacher reflection",
    "exitTicket": "Exit ticket question or activity",
    "homework": "Homework assignment",
    "timeMins": 10
  },
  "suggestedTLMs": ["List of teaching/learning materials"],
  "suggestedObjectives": ["List of learning objectives/outcomes"]
}`;
  }

  if (templateType === "CLASSIC_JHS") {
    return `Generate a complete Classic JHS lesson note for:

${contextParts}

Respond with this JSON structure:
{
  "objectives": {
    "general": "General objective using behavioral verb",
    "specific": ["At least 3 specific objectives with behavioral verbs"]
  },
  "rpk": "Relevant previous knowledge to connect to (HTML formatted)",
  "introduction": "How to introduce the lesson (HTML formatted)",
  "presentationSteps": [
    {
      "stepTitle": "Step name (e.g., Step 1: Introduction to concept)",
      "teacherActivity": "What the teacher does (HTML formatted)",
      "learnerActivity": "What learners do (HTML formatted)",
      "boardWork": "What to write on the board",
      "keyQuestions": ["Questions to ask during this step"],
      "timeMins": 10
    }
  ],
  "corePoints": ["Key points learners should remember"],
  "evaluation": {
    "questions": ["At least 5 evaluation questions"],
    "answers": ["Corresponding answers"],
    "markingNotes": "Notes for marking/grading"
  },
  "remarks": "Placeholder for post-lesson remarks",
  "suggestedTLMs": ["List of teaching/learning materials"]
}`;
  }

  // Simple template
  return `Generate a simple lesson note for:

${contextParts}

Respond with this JSON structure:
{
  "objectives": "Clear learning objectives (HTML formatted with list)",
  "content": "Lesson content with key points, activities, and assessment (HTML formatted)",
  "suggestedTLMs": ["List of teaching/learning materials"]
}`;
}

function buildExpandSectionPrompt(data: GenerateRequest): string {
  const { section, existingContent, topic, subject, templateType } = data;

  return `Expand and improve the following section of a lesson note:

Topic: ${topic}
Subject: ${subject || "Not specified"}
Template: ${templateType}
Section: ${section}

Current content:
${existingContent || "(Empty - generate new content)"}

Provide an expanded, more detailed version. Use HTML formatting (<p>, <ul>, <li>, <strong>, <em>) for structure.

Respond with:
{
  "expandedContent": "The expanded content (HTML formatted)",
  "suggestions": ["Optional improvement suggestions"]
}`;
}

function buildSuggestActivitiesPrompt(data: GenerateRequest): string {
  const { section, topic, subject, gradeLevel, classSize, templateType } = data;

  return `Suggest engaging activities for a ${templateType} lesson:

Topic: ${topic}
Subject: ${subject || "Not specified"}
Grade: ${gradeLevel || "Not specified"}
Class Size: ${classSize || "Average"}
Phase/Section: ${section || "General"}

Provide practical, culturally appropriate activities for Ghanaian classrooms.

Respond with:
{
  "activities": [
    {
      "name": "Activity name",
      "description": "How to conduct the activity",
      "duration": "Estimated time (e.g., '5-10 minutes')",
      "materials": ["Required materials"],
      "groupSize": "Individual/Pairs/Small groups/Whole class",
      "objectives": "What this activity achieves"
    }
  ]
}`;
}

function buildGenerateAssessmentPrompt(data: GenerateRequest): string {
  const { topic, subject, gradeLevel, templateType, existingContent } = data;

  return `Generate assessment items for a lesson on:

Topic: ${topic}
Subject: ${subject || "Not specified"}
Grade: ${gradeLevel || "Not specified"}
Template: ${templateType}

${existingContent ? `Lesson content summary:\n${existingContent}` : ""}

Provide a mix of question types appropriate for Ghanaian education.

Respond with:
{
  "exitTicket": "Quick end-of-lesson check question",
  "evaluationQuestions": [
    {
      "question": "The question",
      "type": "multiple-choice|short-answer|true-false|fill-in-blank",
      "answer": "The correct answer",
      "difficulty": "easy|medium|hard"
    }
  ],
  "homeworkSuggestions": [
    "Suggested homework tasks"
  ],
  "embeddedChecks": [
    "Questions to ask during the lesson"
  ]
}`;
}

function buildGenerateObjectivesPrompt(data: GenerateRequest): string {
  const { topic, subject, gradeLevel, strand, subStrand, contentStandard } = data;

  return `Generate learning objectives for:

Topic: ${topic}
Subject: ${subject || "Not specified"}
Grade: ${gradeLevel || "Not specified"}
${strand ? `Strand: ${strand}` : ""}
${subStrand ? `Sub-strand: ${subStrand}` : ""}
${contentStandard ? `Content Standard: ${contentStandard}` : ""}

Create objectives using Bloom's taxonomy action verbs.

Respond with:
{
  "generalObjective": "One overarching objective",
  "specificObjectives": [
    "3-5 specific, measurable objectives using action verbs"
  ],
  "learningOutcomes": [
    "Expected learning outcomes for students"
  ]
}`;
}

function buildImproveContentPrompt(data: GenerateRequest): string {
  const { existingContent, section, templateType, topic } = data;

  return `Improve the following lesson content:

Topic: ${topic}
Template: ${templateType}
Section: ${section || "General"}

Current content:
${existingContent || "(No content provided)"}

Improve clarity, add detail, ensure pedagogical soundness, and format properly.

Respond with:
{
  "improvedContent": "The improved content (HTML formatted)",
  "changes": ["List of improvements made"],
  "suggestions": ["Additional suggestions for the author"]
}`;
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    // Check permission
    if (!can(context.permissions, PERMISSIONS.journalWrite)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Check OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { success: false, error: "AI service not configured" },
        { status: 500 }
      );
    }

    // Parse and validate request
    const body = await req.json().catch(() => null);
    const parsed = GenerateRequestSchema.safeParse(body);
    if (!parsed.success) {
      const errorMessages = parsed.error.issues?.map((issue) => issue.message).join(", ") || "Invalid data";
      return Response.json(
        { success: false, error: `Validation failed: ${errorMessages}` },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Build prompts based on action
    const systemPrompt = buildSystemPrompt(data.templateType);
    let userPrompt: string;

    switch (data.action) {
      case "full_lesson":
        userPrompt = buildFullLessonPrompt(data);
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

    // Call OpenAI
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

    // Parse JSON response
    let aiResponse;
    try {
      aiResponse = JSON.parse(responseText);
    } catch {
      // Fallback: try to extract JSON from markdown if present
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse AI response");
      }
    }

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
