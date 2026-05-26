import type { ExploreAiGenerationOutput } from "@/lib/learn/explore/explore-schemas";
import type { ResolvedExploreGenerationContext } from "@/lib/learn/explore/explore-types";
import { Types } from "mongoose";

function sessionExploreSlug(sessionId: Types.ObjectId | string) {
  return String(sessionId).slice(-6);
}

function pickExploreAngleIndex(sessionId: Types.ObjectId | string, modulo: number) {
  const hex = String(sessionId).slice(-4);
  const value = Number.parseInt(hex, 16);
  return Number.isFinite(value) ? value % modulo : 0;
}

function buildTemplateEndingQuiz(input: {
  sessionId: Types.ObjectId;
  sessionTitle: string;
  subjectName: string;
}) {
  const slug = sessionExploreSlug(input.sessionId);
  const letters = ["A", "B", "C", "D"] as const;

  const questions = [
    {
      id: `${slug}-q1`,
      prompt: `Which idea from this Explore adventure about ${input.sessionTitle} is NEW compared to class notes?`,
      options: letters.map((letter, index) => ({
        id: `${slug}-q1-${letter}`,
        letter,
        label: `Option ${letter} — sample ${index + 1}`,
      })),
      correctOptionId: `${slug}-q1-A`,
      explanation:
        "Explore quizzes should check the extra mission content, not only the class lesson.",
    },
    {
      id: `${slug}-q2`,
      prompt: `How can ${input.subjectName} connect to everyday life in Ghana?`,
      options: letters.map((letter, index) => ({
        id: `${slug}-q2-${letter}`,
        letter,
        label: `Example ${index + 1}`,
      })),
      correctOptionId: `${slug}-q2-B`,
      explanation: "Real-life connections help memory and curiosity.",
    },
    {
      id: `${slug}-q3`,
      prompt: "What should you do if you notice a common misconception?",
      options: letters.map((letter, index) => ({
        id: `${slug}-q3-${letter}`,
        letter,
        label: `Response ${index + 1}`,
      })),
      correctOptionId: `${slug}-q3-C`,
      explanation: "Leo encourages gentle correction and a quick check question.",
    },
    {
      id: `${slug}-q4`,
      prompt: "Why does Leo want you to go deeper after class?",
      options: letters.map((letter, index) => ({
        id: `${slug}-q4-${letter}`,
        letter,
        label: `Reason ${index + 1}`,
      })),
      correctOptionId: `${slug}-q4-D`,
      explanation: "Going deeper builds understanding beyond memorizing class notes.",
    },
  ];

  return {
    id: `${slug}-quiz`,
    title: "Quick Explore quiz",
    questions,
  };
}

/** Deterministic safe fallback when OpenAI is unavailable (dev / outage). */
export function buildExploreTemplateFallback(
  context: ResolvedExploreGenerationContext
): ExploreAiGenerationOutput {
  const lessonObjectId = new Types.ObjectId(context.lessonId);
  const slug = sessionExploreSlug(lessonObjectId);
  const angleIndex = pickExploreAngleIndex(lessonObjectId, 3);
  const angles = [
    "real life in Ghana",
    "how people use this idea today",
    "surprising connections beyond class",
  ];
  const angle = angles[angleIndex];

  return {
    title: `Go deeper: ${context.lessonTitle}`,
    subjectName: context.subjectName,
    sourceLessonTitle: context.lessonTitle,
    gradeName: context.gradeName,
    difficulty: "standard",
    estimatedMinutes: 10,
    missionType: "story_lab",
    adventureAngle: `Leo explores ${context.lessonTitle} through ${angle} — not a repeat of class notes.`,
    studentPromise: "You will spot this idea in the world around you and fix one common mix-up.",
    intro: `Your class already covered ${context.lessonTitle}. Leo built a fresh mission about ${angle}.`,
    category: "go_deeper",
    deepDiveExplanation: {
      title: "Beyond the class explanation",
      conceptBridge: `In class you learned the basics of ${context.lessonTitle}.`,
      deeperExplanation:
        "Now imagine the same idea showing up in news, nature, technology, or community life. Leo wants you to connect the classroom idea to something you can notice this week.",
      realWorldConnection:
        "In Ghana, students might notice this idea at home, in the market, on a farm, or in a local business — look for one real example.",
    },
    misconceptions: [
      {
        id: `${slug}-m1`,
        misconception: "The class definition is the only way to think about the topic.",
        whyStudentsThinkThis: "The lesson notes feel complete after class.",
        leoCorrection:
          "Class notes are a starting point. Explore adds new angles, examples, and checks so you can use the idea in real life.",
        quickCheckPrompt: "Name one place outside school where this idea might appear.",
      },
    ],
    tryItActivity: {
      id: `${slug}-try1`,
      title: "Spot it this week",
      type: "observe",
      safetyLevel: "safe_independent",
      instructions: [
        "Choose a safe public place you visit with family.",
        "Look for one example related to the lesson topic.",
        "Sketch or describe what you noticed.",
      ],
      reflectionPrompt: "How is your example different from what you wrote in class notes?",
    },
    parentConversationPrompt: {
      title: "Talk at home",
      prompt: `Ask your child to explain ${context.lessonTitle} using an example from home or the community.`,
      expectedLearningOutcome:
        "The child explains the idea in their own words with a local example.",
    },
    curiosityPathways: [
      {
        id: `${slug}-c1`,
        label: "Ask Leo more",
        description: "Go even deeper with Leo tutor.",
        nextAdventurePrompt: `Explain ${context.lessonTitle} with another Ghanaian example.`,
      },
    ],
    vocabulary: [
      {
        id: `${slug}-v1`,
        word: "Go deeper",
        meaning: "Learn more than what was said in class.",
        simpleExample: `You can explore beyond ${context.lessonTitle}.`,
      },
    ],
    readingTasks: [
      {
        id: `${slug}-r1`,
        title: `How ${context.lessonTitle} shows up in everyday life`,
        passage:
          "Class gave you the core idea. This reading adds a new lens: watch how the same idea appears in places students in Ghana know well — homes, schools, markets, farms, and community projects. Your job is to connect, compare, and ask better questions.",
        readingLevel: context.gradeName,
        questions: [
          "Where could you spot this idea near your school?",
          "What is one question you still have?",
        ],
      },
    ],
    funFacts: [
      {
        id: `${slug}-f1`,
        headline: "Did you know?",
        fact: "Scientists and learners often discover new uses for a classroom idea years after it was first taught.",
        whyItMatters: `It shows why ${context.lessonTitle} can stay useful outside the exam.`,
      },
      {
        id: `${slug}-f2`,
        headline: "Ghana connection",
        fact: "Many school topics connect to local jobs, weather, food, or community projects students see every day.",
        whyItMatters: "Linking class work to real life helps memory and curiosity.",
      },
    ],
    checkpoints: [
      {
        id: `${slug}-cp1`,
        type: "reflection",
        prompt: "What is one new thing you learned that was NOT in the class notes?",
      },
    ],
    endingQuiz: buildTemplateEndingQuiz({
      sessionId: lessonObjectId,
      sessionTitle: context.lessonTitle,
      subjectName: context.subjectName,
    }),
    leoPrompts: [
      "Give me a simpler explanation",
      "One more Ghanaian example",
      "Quiz me on this adventure",
    ],
  };
}
