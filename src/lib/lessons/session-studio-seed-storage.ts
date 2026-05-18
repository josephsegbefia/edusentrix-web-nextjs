const PREFIX = "edusentrix-session-studio-seed:";

export type SessionStudioSeedPayload = {
  title: string;
  instructions: string;
  type: "assignment" | "quiz" | "project" | "practice";
  subjectId: string;
  classGroupIds: string[];
  maxScore: number;
  questions?: Array<{
    id: string;
    prompt: string;
    points: number;
    explanation?: string | null;
    choices: Array<{ id: string; text: string; isCorrect: boolean }>;
  }>;
};

export function writeSessionStudioSeed(sessionId: string, payload: SessionStudioSeedPayload) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`${PREFIX}${sessionId}`, JSON.stringify(payload));
}

export function readSessionStudioSeed(sessionId: string): SessionStudioSeedPayload | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(`${PREFIX}${sessionId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionStudioSeedPayload;
  } catch {
    return null;
  }
}

export function clearSessionStudioSeed(sessionId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(`${PREFIX}${sessionId}`);
}
