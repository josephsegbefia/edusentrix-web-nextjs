import "server-only";

import { Types } from "mongoose";

export type AdventureQuizOption = {
  id: string;
  letter: string;
  label: string;
};

export type AdventureQuizQuestion = {
  id: string;
  prompt: string;
  options: AdventureQuizOption[];
  correctOptionId: string;
  explanation: string;
};

export type AdventureEndingQuiz = {
  id: string;
  title: string;
  questions: AdventureQuizQuestion[];
};

/** Stored on each student's adventure after they submit the ending quiz. */
export type StoredAdventureQuizAttempt = {
  submittedAt: string;
  answers: Array<{
    questionId: string;
    selectedOptionId: string;
    correct: boolean;
  }>;
  scorePercent: number;
  correctCount: number;
  totalCount: number;
};

const LETTERS = ["A", "B", "C", "D"] as const;

export function sessionExploreSlug(sessionId: Types.ObjectId | string) {
  return String(sessionId).slice(-6);
}

export function pickExploreAngleIndex(sessionId: Types.ObjectId | string, modulo: number) {
  const hex = String(sessionId).slice(-4);
  const value = Number.parseInt(hex, 16);
  return Number.isFinite(value) ? value % modulo : 0;
}

export function serializeQuizForStudent(quiz: AdventureEndingQuiz) {
  return {
    id: quiz.id,
    title: quiz.title,
    questions: quiz.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      options: question.options.map((option) => ({
        id: option.id,
        letter: option.letter,
        label: option.label,
      })),
    })),
  };
}

export function buildTemplateEndingQuiz(input: {
  sessionId: Types.ObjectId;
  sessionTitle: string;
  subjectName: string;
}): AdventureEndingQuiz {
  const slug = sessionExploreSlug(input.sessionId);
  const angleIndex = pickExploreAngleIndex(input.sessionId, 4);

  const anglePrompts = [
    `Which example best shows how "${input.sessionTitle}" connects to everyday life in Ghana?`,
    `What is one NEW idea from this Explore adventure about ${input.sessionTitle}?`,
    `Why does going beyond the class lesson on ${input.sessionTitle} help you learn?`,
    `Who might use knowledge about ${input.sessionTitle} in a real job or project?`,
  ];

  const makeQuestion = (
    index: number,
    prompt: string,
    options: [string, string, string, string],
    correctIndex: number,
    explanation: string
  ): AdventureQuizQuestion => {
    const optionRows = options.map((label, optionIndex) => ({
      id: `opt-${slug}-q${index}-${optionIndex}`,
      letter: LETTERS[optionIndex],
      label,
    }));

    return {
      id: `eq-${slug}-${index}`,
      prompt,
      options: optionRows,
      correctOptionId: optionRows[correctIndex].id,
      explanation,
    };
  };

  const questions: AdventureQuizQuestion[] = [
    makeQuestion(
      0,
      anglePrompts[angleIndex],
      [
        "It only repeats what the teacher said word for word",
        "It adds fresh examples, fun facts, or real-life links beyond class",
        "It replaces your textbook completely",
        "It gives final exam answers without practice",
      ],
      1,
      "Explore adventures are meant to add new knowledge beyond the class lesson."
    ),
    makeQuestion(
      1,
      `A "Did you know?" card in this ${input.subjectName} adventure should mainly:`,
      [
        "Surprise you with something new linked to the topic",
        "Copy your class notes exactly",
        "Ask you to skip reading",
        "Share unsafe or unrelated content",
      ],
      0,
      "Fun facts should be surprising, accurate, and linked to what you explored."
    ),
    makeQuestion(
      2,
      `After reading about ${input.sessionTitle} in Explore, a strong reflection would be:`,
      [
        "Naming one new idea you did not hear in class",
        "Memorising every date without understanding",
        "Ignoring the lesson completely",
        "Only copying a friend's answer",
      ],
      0,
      "Reflections work best when you name something new you understood."
    ),
    makeQuestion(
      3,
      "If two class lessons feel similar, Leo's Explore adventures should:",
      [
        "Use the same fun facts and readings for both",
        "Stay different — each lesson gets its own angle and quiz",
        "Only show vocabulary from flashcards",
        "Skip quizzes entirely",
      ],
      1,
      "Each lesson adventure should feel unique even when topics are related."
    ),
  ];

  return {
    id: `quiz-${slug}`,
    title: "Quick Explore quiz",
    questions,
  };
}

export function gradeExploreQuizAttempt(
  quiz: AdventureEndingQuiz,
  answers: Array<{ questionId: string; selectedOptionId: string }>
) {
  const questionMap = new Map(quiz.questions.map((q) => [q.id, q]));
  const graded = answers.map((answer) => {
    const question = questionMap.get(answer.questionId);
    const correct = question
      ? answer.selectedOptionId === question.correctOptionId
      : false;
    return {
      questionId: answer.questionId,
      selectedOptionId: answer.selectedOptionId,
      correct,
    };
  });

  const totalCount = quiz.questions.length;
  const correctCount = graded.filter((row) => row.correct).length;
  const scorePercent =
    totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  return {
    submittedAt: new Date().toISOString(),
    answers: graded,
    scorePercent,
    correctCount,
    totalCount,
  };
}

export function buildQuizSubmitResponse(
  quiz: AdventureEndingQuiz,
  attempt: StoredAdventureQuizAttempt
) {
  const questionMap = new Map(quiz.questions.map((q) => [q.id, q]));

  return {
    scorePercent: attempt.scorePercent,
    correctCount: attempt.correctCount,
    totalCount: attempt.totalCount,
    submittedAt: attempt.submittedAt,
    results: attempt.answers.map((answer) => {
      const question = questionMap.get(answer.questionId);
      return {
        questionId: answer.questionId,
        prompt: question?.prompt ?? "",
        selectedOptionId: answer.selectedOptionId,
        correct: answer.correct,
        correctOptionId: question?.correctOptionId ?? "",
        explanation: question?.explanation ?? "",
      };
    }),
  };
}
