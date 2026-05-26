import "server-only";

import { Types } from "mongoose";
import OpenAI from "openai";
import { connectToDatabase } from "@/db/connectToDatabase";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { getStudentLearnAccess } from "@/lib/learn/access";
import { recordLearnMobileActivity } from "@/lib/learn/mobile-activity";
import {
  loadMobileStudentBundle,
  serializeMobileLoginStudent,
} from "@/lib/learn/mobile-student-profile";
import { ClassGroup } from "@/models/ClassGroup";
import { LearnLanguagePracticeProgress } from "@/models/LearnLanguagePracticeProgress";
import { LessonFlashcard } from "@/models/LessonFlashcard";
import { LessonFlashcardDeck } from "@/models/LessonFlashcardDeck";
import { LessonSession } from "@/models/LessonSession";
import { SubjectOffering } from "@/models/SubjectOffering";

const CAUTION_NOTE =
  "I may need your teacher's approved spelling for this word. Let's check the lesson note when it is available.";

type LanguagePack = {
  code: string;
  name: string;
  variant?: string;
  greeting: { word: string; meaningEnglish: string; pronunciationHint?: string };
  vocabulary: Array<{
    id: string;
    word: string;
    meaningEnglish: string;
    pronunciationHint?: string;
    exampleSentence?: string;
    culturalNote?: string;
    status: "new" | "learning" | "mastered" | "needs_practice";
  }>;
  practiceItems: Array<{
    id: string;
    type: "vocabulary" | "translation" | "reading" | "conversation" | "pronunciation";
    prompt: string;
    answer?: string;
    explanation?: string;
  }>;
  culturalContext: string[];
};

const LANGUAGE_PACKS: Record<string, LanguagePack> = {
  ewe: {
    code: "ewe",
    name: "Ewe",
    greeting: { word: "Miawoe zɔ", meaningEnglish: "Welcome", pronunciationHint: "mee-ah-wo-eh zoh" },
    vocabulary: [
      {
        id: "ewe-suku",
        word: "Suku",
        meaningEnglish: "School",
        pronunciationHint: "soo-koo",
        exampleSentence: "Mele suku me.",
        culturalNote: "Spelling and tone may vary by approved school material.",
        status: "learning",
      },
      {
        id: "ewe-nu",
        word: "Nu",
        meaningEnglish: "Thing / something",
        pronunciationHint: "noo",
        status: "new",
      },
    ],
    practiceItems: [
      {
        id: "ewe-vocab",
        type: "vocabulary",
        prompt: "What does Suku mean in English?",
        answer: "School",
        explanation: "Use your teacher's approved spelling when writing.",
      },
      {
        id: "ewe-pronunciation",
        type: "pronunciation",
        prompt: "Read Miawoe zɔ slowly using the pronunciation hint.",
        explanation: "Pronunciation practice is text-only until audio is approved.",
      },
    ],
    culturalContext: [
      "Ewe is spoken in parts of Ghana, Togo, and Benin.",
      "Your school-approved spelling should guide final answers.",
    ],
  },
  "twi-asante": {
    code: "twi-asante",
    name: "Twi",
    variant: "Asante Twi",
    greeting: { word: "Akwaaba", meaningEnglish: "Welcome", pronunciationHint: "ah-kwaa-ba" },
    vocabulary: [
      {
        id: "twi-sukuu",
        word: "Sukuu",
        meaningEnglish: "School",
        pronunciationHint: "soo-koo",
        exampleSentence: "Mekɔ sukuu.",
        status: "mastered",
      },
      {
        id: "twi-adwuma",
        word: "Adwuma",
        meaningEnglish: "Work",
        pronunciationHint: "ah-jwoo-ma",
        status: "learning",
      },
    ],
    practiceItems: [
      {
        id: "twi-translation",
        type: "translation",
        prompt: "Translate Akwaaba to English.",
        answer: "Welcome",
      },
    ],
    culturalContext: [
      "Twi has dialects, including Asante Twi and Akuapem Twi.",
      "Use the variant your school teaches for spelling and pronunciation.",
    ],
  },
  "twi-akuapem": {
    code: "twi-akuapem",
    name: "Twi",
    variant: "Akuapem Twi",
    greeting: { word: "Akwaaba", meaningEnglish: "Welcome", pronunciationHint: "ah-kwaa-ba" },
    vocabulary: [
      {
        id: "twi-ak-sukuu",
        word: "Sukuu",
        meaningEnglish: "School",
        status: "learning",
      },
    ],
    practiceItems: [
      {
        id: "twi-ak-vocab",
        type: "vocabulary",
        prompt: "What does Sukuu mean?",
        answer: "School",
      },
    ],
    culturalContext: ["Akuapem Twi spelling may differ from Asante Twi."],
  },
  ga: {
    code: "ga",
    name: "Ga",
    greeting: { word: "Ojekoo", meaningEnglish: "Thank you / well done", pronunciationHint: "oh-jeh-koo" },
    vocabulary: [
      { id: "ga-skuul", word: "Skuul", meaningEnglish: "School", status: "new" },
    ],
    practiceItems: [
      {
        id: "ga-reading",
        type: "reading",
        prompt: "Read the greeting and explain when someone might use it.",
      },
    ],
    culturalContext: ["Ga is spoken widely in and around Accra."],
  },
  dagbani: {
    code: "dagbani",
    name: "Dagbani",
    greeting: { word: "Dasiba", meaningEnglish: "Thank you", pronunciationHint: "dah-see-ba" },
    vocabulary: [
      { id: "dagbani-sch", word: "Karatu", meaningEnglish: "School / learning place", status: "new" },
    ],
    practiceItems: [
      {
        id: "dagbani-vocab",
        type: "vocabulary",
        prompt: "What does the greeting Dasiba express?",
        answer: "Thank you",
      },
    ],
    culturalContext: ["Dagbani is spoken in northern Ghana."],
  },
  fante: {
    code: "fante",
    name: "Fante",
    greeting: { word: "Akwaaba", meaningEnglish: "Welcome" },
    vocabulary: [
      { id: "fante-sukuu", word: "Sukuu", meaningEnglish: "School", status: "learning" },
    ],
    practiceItems: [
      {
        id: "fante-translation",
        type: "translation",
        prompt: "Translate Akwaaba to English.",
        answer: "Welcome",
      },
    ],
    culturalContext: ["Fante is an Akan variety spoken in parts of southern Ghana."],
  },
};

type OfferingRow = {
  _id: Types.ObjectId;
  displayName: string;
  shortName: string;
  subjectFamily: string;
};

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function detectLanguageCode(offering: OfferingRow): string | null {
  const text = `${offering.displayName} ${offering.shortName} ${offering.subjectFamily}`.toLowerCase();

  if (text.includes("ewe")) return "ewe";
  if (text.includes("akuapem") && text.includes("twi")) return "twi-akuapem";
  if (text.includes("asante") && text.includes("twi")) return "twi-asante";
  if (/\btwi\b/.test(text)) return "twi-asante";
  if (text.includes("dagbani")) return "dagbani";
  if (text.includes("fante")) return "fante";
  if (text.includes("nzema")) return "nzema";
  if (text.includes("dangme")) return "dangme";
  if (text.includes("gonja")) return "gonja";
  if (text.includes("ga") && !text.includes("ghanaian language")) return "ga";
  if (text.includes("ghanaian language") || text.includes("ghl")) return "twi-asante";

  return null;
}

function isGhanaianLanguageOffering(offering: OfferingRow) {
  return detectLanguageCode(offering) !== null;
}

async function assertLanguageAccess(context: LearnMobileStudentContext) {
  const access = await getStudentLearnAccess({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
  });

  if (!access.hasAccess) {
    return {
      ok: false as const,
      code: access.schoolEligible ? "LEARN_ACCESS_REQUIRED" : "SCHOOL_NOT_ELIGIBLE",
      message: access.blockedReason || "Learn access required.",
      status: 403,
    };
  }

  if (!context.classGroupId) {
    return {
      ok: false as const,
      code: "NO_STUDENT_PROFILE",
      message: "Class group not found.",
      status: 404,
    };
  }

  return { ok: true as const };
}

async function loadClassLanguageOfferings(context: LearnMobileStudentContext) {
  const classGroup = await ClassGroup.findOne({
    _id: context.classGroupId,
    schoolId: context.schoolId,
  })
    .select("subjectOfferingIds")
    .lean<{ subjectOfferingIds: Types.ObjectId[] } | null>();

  if (!classGroup) return { offerings: [] as OfferingRow[], selectedIds: new Set<string>() };

  const offeringIds = classGroup.subjectOfferingIds ?? [];
  const offerings = await SubjectOffering.find({
    schoolId: context.schoolId,
    _id: { $in: offeringIds },
    isActive: true,
  })
    .select("displayName shortName subjectFamily")
    .lean<OfferingRow[]>();

  const ghanaian = offerings.filter(isGhanaianLanguageOffering);
  const selectedIds = new Set(offeringIds.map(String));

  return { offerings: ghanaian, selectedIds };
}

async function loadProgressMap(context: LearnMobileStudentContext) {
  const rows = await LearnLanguagePracticeProgress.find({
    schoolId: context.schoolId,
    studentId: context.studentId,
  }).lean<
    Array<{
      languageCode: string;
      sessionsCompleted: number;
      practiceMinutes: number;
      lastPracticedAt?: Date | null;
    }>
  >();

  return new Map(rows.map((r) => [r.languageCode, r]));
}

function buildLanguageSummary(
  offering: OfferingRow,
  selectedIds: Set<string>,
  progressMap: Map<string, { sessionsCompleted: number; practiceMinutes: number; lastPracticedAt?: Date | null }>
) {
  const code = detectLanguageCode(offering) ?? normalizeSlug(offering.displayName);
  const pack = LANGUAGE_PACKS[code];
  const progress = progressMap.get(code);
  const sessions = progress?.sessionsCompleted ?? 0;
  const minutes = progress?.practiceMinutes ?? 0;
  const progressPercent = Math.min(100, sessions * 12 + Math.min(minutes, 40));

  return {
    id: code,
    name: pack?.name ?? offering.displayName,
    variant: pack?.variant ?? (offering.displayName !== pack?.name ? offering.displayName : undefined),
    schoolSelected: selectedIds.has(String(offering._id)),
    progressPercent,
    vocabularyCount: pack?.vocabulary.length ?? 0,
    readingTaskCount: pack?.practiceItems.filter((p) => p.type === "reading").length,
    pronunciationPracticeAvailable: pack?.practiceItems.some((p) => p.type === "pronunciation") ?? false,
    cautionNote: CAUTION_NOTE,
    offeringId: String(offering._id),
  };
}

async function loadLessonVocabulary(
  context: LearnMobileStudentContext,
  offeringId: Types.ObjectId
) {
  const sessions = await LessonSession.find({
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    subjectOfferingId: offeringId,
    status: "published",
  })
    .select("_id")
    .limit(3)
    .lean<Array<{ _id: Types.ObjectId }>>();

  if (sessions.length === 0) return [];

  const decks = await LessonFlashcardDeck.find({
    schoolId: context.schoolId,
    sessionId: { $in: sessions.map((s) => s._id) },
    status: "published",
  })
    .select("_id")
    .lean<Array<{ _id: Types.ObjectId }>>();

  if (decks.length === 0) return [];

  const cards = await LessonFlashcard.find({
    schoolId: context.schoolId,
    deckId: { $in: decks.map((d) => d._id) },
  })
    .sort({ order: 1 })
    .limit(8)
    .select("front back")
    .lean<Array<{ front: string; back: string }>>();

  return cards.map((card, index) => ({
    id: `lesson-${String(offeringId)}-${index}`,
    word: card.front.slice(0, 48),
    meaningEnglish: card.back.slice(0, 120),
    culturalNote: "From your class lesson flashcards. Confirm spelling with your teacher.",
    status: "learning" as const,
  }));
}

async function resolveLanguageById(context: LearnMobileStudentContext, languageId: string) {
  const { offerings, selectedIds } = await loadClassLanguageOfferings(context);

  const code = languageId.toLowerCase();
  const offering =
    offerings.find((o) => detectLanguageCode(o) === code) ??
    offerings.find((o) => normalizeSlug(o.displayName) === code);

  if (!offering) return null;

  return { offering, selectedIds, code: detectLanguageCode(offering) ?? code };
}

function buildLanguageDetail(
  code: string,
  offering: OfferingRow,
  schoolSelected: boolean,
  progressPercent: number,
  extraVocabulary: LanguagePack["vocabulary"]
) {
  const pack = LANGUAGE_PACKS[code] ?? {
    code,
    name: offering.displayName,
    greeting: { word: "Akwaaba", meaningEnglish: "Welcome" },
    vocabulary: [],
    practiceItems: [
      {
        id: `${code}-practice`,
        type: "vocabulary" as const,
        prompt: `Practice a word from ${offering.displayName}.`,
      },
    ],
    culturalContext: ["Follow your teacher's approved spelling and dialect."],
  };

  const mergedVocabulary = [
    ...pack.vocabulary,
    ...extraVocabulary.filter((v) => !pack.vocabulary.some((p) => p.word === v.word)),
  ];

  return {
    id: code,
    name: pack.name,
    variant: pack.variant,
    schoolSelected,
    progressPercent,
    vocabularyCount: mergedVocabulary.length,
    readingTaskCount: pack.practiceItems.filter((p) => p.type === "reading").length,
    pronunciationPracticeAvailable: pack.practiceItems.some((p) => p.type === "pronunciation"),
    cautionNote: CAUTION_NOTE,
    greeting: pack.greeting,
    vocabulary: mergedVocabulary,
    practiceItems: pack.practiceItems,
    culturalContext: pack.culturalContext,
  };
}

export async function buildMobileGhanaianLanguagesList(context: LearnMobileStudentContext) {
  await connectToDatabase();
  const gate = await assertLanguageAccess(context);
  if (!gate.ok) return gate;

  const bundle = await loadMobileStudentBundle({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
  });

  if (!bundle) {
    return {
      ok: false as const,
      code: "NO_STUDENT_PROFILE",
      message: "Student profile not found.",
      status: 404,
    };
  }

  const profile = serializeMobileLoginStudent(bundle);
  const { offerings, selectedIds } = await loadClassLanguageOfferings(context);
  const progressMap = await loadProgressMap(context);

  const languages = offerings.map((offering) => {
    const summary = buildLanguageSummary(offering, selectedIds, progressMap);
    const { offeringId: _oid, ...rest } = summary;
    return rest;
  });

  if (languages.length === 0) {
    return {
      ok: false as const,
      code: "NO_LANGUAGE_SELECTED",
      message: "No Ghanaian language configured for this class.",
      status: 404,
    };
  }

  return {
    ok: true as const,
    data: {
      studentId: profile.studentId,
      leoTip:
        "Ghanaian language practice should follow your teacher's spelling, dialect, and lesson notes. Leo will stay careful when unsure.",
      languages,
    },
  };
}

export async function buildMobileGhanaianLanguageDetail(
  context: LearnMobileStudentContext,
  languageId: string
) {
  await connectToDatabase();
  const gate = await assertLanguageAccess(context);
  if (!gate.ok) return gate;

  const resolved = await resolveLanguageById(context, languageId);
  if (!resolved) {
    return {
      ok: false as const,
      code: "LANGUAGE_NOT_FOUND",
      message: "Language not found.",
      status: 404,
    };
  }

  const progress = await LearnLanguagePracticeProgress.findOne({
    schoolId: context.schoolId,
    studentId: context.studentId,
    languageCode: resolved.code,
  }).lean<{ sessionsCompleted: number; practiceMinutes: number } | null>();

  const sessions = progress?.sessionsCompleted ?? 0;
  const minutes = progress?.practiceMinutes ?? 0;
  const progressPercent = Math.min(100, sessions * 12 + Math.min(minutes, 40));

  const lessonVocab = await loadLessonVocabulary(context, resolved.offering._id);

  return {
    ok: true as const,
    data: buildLanguageDetail(
      resolved.code,
      resolved.offering,
      resolved.selectedIds.has(String(resolved.offering._id)),
      progressPercent,
      lessonVocab
    ),
  };
}

export async function buildMobileGhanaianVocabulary(
  context: LearnMobileStudentContext,
  languageId: string
) {
  const detail = await buildMobileGhanaianLanguageDetail(context, languageId);
  if (!detail.ok) return detail;

  return {
    ok: true as const,
    data: {
      languageId: detail.data.id,
      vocabulary: detail.data.vocabulary,
    },
  };
}

export async function submitMobileGhanaianPractice(
  context: LearnMobileStudentContext,
  languageId: string,
  body: { answers?: Array<{ itemId: string; response: string }>; elapsedMinutes?: number }
) {
  await connectToDatabase();
  const gate = await assertLanguageAccess(context);
  if (!gate.ok) return gate;

  const resolved = await resolveLanguageById(context, languageId);
  if (!resolved) {
    return {
      ok: false as const,
      code: "LANGUAGE_NOT_FOUND",
      message: "Language not found.",
      status: 404,
    };
  }

  const pack = LANGUAGE_PACKS[resolved.code];
  const languageName = pack?.name ?? resolved.offering.displayName;
  const minutes = Math.max(1, body.elapsedMinutes ?? 5);
  const answerCount = body.answers?.length ?? 0;

  const progress = await LearnLanguagePracticeProgress.findOneAndUpdate(
    {
      schoolId: context.schoolId,
      studentId: context.studentId,
      languageCode: resolved.code,
    },
    {
      $set: {
        schoolId: context.schoolId,
        studentId: context.studentId,
        accountId: context.accountId,
        languageCode: resolved.code,
        languageName,
        lastPracticedAt: new Date(),
      },
      $inc: {
        sessionsCompleted: 1,
        practiceMinutes: minutes,
      },
      $setOnInsert: {
        weakAreas: answerCount < 2 ? ["Keep reviewing vocabulary"] : [],
        strengths: answerCount >= 2 ? ["Good vocabulary effort"] : [],
      },
    },
    { upsert: true, new: true }
  ).lean();

  await recordLearnMobileActivity({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
    gradeId: context.gradeId,
    classGroupId: context.classGroupId,
    eventType: "language_practice",
    metadata: {
      languageId: resolved.code,
      languageName,
      answerCount,
      sessionsCompleted: progress?.sessionsCompleted ?? 1,
    },
  });

  const sessions = progress?.sessionsCompleted ?? 1;
  const totalMinutes = progress?.practiceMinutes ?? minutes;

  return {
    ok: true as const,
    data: {
      languageId: resolved.code,
      sessionsCompleted: sessions,
      practiceMinutes: totalMinutes,
      progressPercent: Math.min(100, sessions * 12 + Math.min(totalMinutes, 40)),
      message: "Nice practice! Leo saved your progress.",
    },
  };
}

export async function buildMobileGhanaianLeoHelp(
  context: LearnMobileStudentContext,
  languageId: string,
  body: { message?: string }
) {
  await connectToDatabase();
  const gate = await assertLanguageAccess(context);
  if (!gate.ok) return gate;

  const resolved = await resolveLanguageById(context, languageId);
  if (!resolved) {
    return {
      ok: false as const,
      code: "LANGUAGE_NOT_FOUND",
      message: "Language not found.",
      status: 404,
    };
  }

  const pack = LANGUAGE_PACKS[resolved.code];
  const languageName = pack?.name ?? resolved.offering.displayName;
  const variant = pack?.variant ? ` (${pack.variant})` : "";
  const studentMessage = body.message?.trim() || `Help me practice ${languageName}.`;

  let answer = `${CAUTION_NOTE} For ${languageName}${variant}, I can explain words, give pronunciation hints, and ask short practice questions — but I will not guess a spelling your teacher has not approved.`;

  if (process.env.OPENAI_API_KEY?.trim()) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.6,
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content: `You help Ghanaian school students practice ${languageName}${variant}. Be cautious about dialect spelling. Never claim a translation is definitely correct without teacher-approved notes. Keep answers short and encouraging.`,
          },
          { role: "user", content: studentMessage },
        ],
      });
      const ai = completion.choices[0]?.message?.content?.trim();
      if (ai) {
        answer = `${ai}\n\nReminder: ${CAUTION_NOTE}`;
      }
    } catch {
      // Use fallback answer
    }
  }

  await recordLearnMobileActivity({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
    gradeId: context.gradeId,
    classGroupId: context.classGroupId,
    eventType: "language_practice",
    metadata: { languageId: resolved.code, phase: "leo_help" },
  });

  return {
    ok: true as const,
    data: {
      message: answer,
      suggestedPrompts: [
        "Explain this word simply",
        "Give me a pronunciation hint",
        "Ask me one practice question",
        "What should I check in my lesson notes?",
      ],
      sources: [{ title: `${languageName} class language`, type: "language" as const }],
    },
  };
}
