import "server-only";

import type { Types } from "mongoose";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { recordLearnMobileActivity } from "@/lib/learn/mobile-activity";
import type { MobileTutorMode } from "@/lib/learn/mobile-tutor";

export type LeoSafetyStatus = "allowed" | "blocked" | "rewritten";

export type LeoSafetyReviewResult = {
  status: LeoSafetyStatus;
  blockedMessage?: string;
  message: string;
  flags: string[];
};

const UNSAFE_RULES: Array<{ pattern: RegExp; flag: string; block?: boolean }> = [
  { pattern: /\b(kill|suicide|self[- ]?harm)\b/i, flag: "unsafe_topic", block: true },
  { pattern: /\b(sex|porn|nude)\b/i, flag: "adult_content", block: true },
  { pattern: /\b(password|credit card|bank)\b/i, flag: "private_data", block: true },
  {
    pattern: /\b(write my homework|do my assignment|give me the answer|final answer only)\b/i,
    flag: "homework_completion_request",
  },
  { pattern: /\b(cheat|copy answers|exam leak)\b/i, flag: "integrity_risk", block: true },
];

const HINT_FIRST_MESSAGE =
  "I can help you learn step by step, but I won't give the final answer before you try. What part feels tricky?";

export function reviewLeoStudentMessage(input: {
  message: string;
  mode: MobileTutorMode;
  hasStudentAttempted?: boolean;
}): LeoSafetyReviewResult {
  const trimmed = input.message.trim();
  const flags: string[] = [];
  let blocked = false;

  for (const rule of UNSAFE_RULES) {
    if (rule.pattern.test(trimmed)) {
      flags.push(rule.flag);
      if (rule.block) blocked = true;
    }
  }

  if (
    /\b(just tell me|only the answer|write it for me)\b/i.test(trimmed) &&
    (input.mode === "hint" || flags.includes("homework_completion_request")) &&
    input.hasStudentAttempted === false
  ) {
    flags.push("answer_before_attempt");
    blocked = true;
  }

  if (blocked) {
    return {
      status: "blocked",
      message: trimmed,
      flags,
      blockedMessage:
        flags.includes("unsafe_topic") || flags.includes("adult_content")
          ? "Let's keep our chat focused on school learning. Ask Leo about your lesson instead."
          : flags.includes("integrity_risk")
            ? "Leo helps you practice fairly. Try a hint or explanation instead."
            : HINT_FIRST_MESSAGE,
    };
  }

  if (flags.includes("homework_completion_request")) {
    return {
      status: "rewritten",
      message: `${trimmed}\n\n(Respond with hints and steps only — not the final homework answer.)`,
      flags: [...flags, "hint_first_enforced"],
    };
  }

  return { status: "allowed", message: trimmed, flags };
}

export function reviewLeoAssistantReply(content: string): {
  content: string;
  flags: string[];
  status: LeoSafetyStatus;
} {
  const flags: string[] = [];
  let safe = content.trim();

  if (/\b(here is the final answer|the answer is)\b/i.test(safe) && safe.length < 140) {
    flags.push("possible_answer_reveal");
    safe = `${HINT_FIRST_MESSAGE}\n\n${safe}`;
  }

  return {
    status: flags.length ? "rewritten" : "allowed",
    content: safe,
    flags,
  };
}

export async function recordLeoSafetyEvent(input: {
  context: LearnMobileStudentContext;
  conversationId?: Types.ObjectId;
  status: LeoSafetyStatus;
  flags: string[];
  mode: MobileTutorMode;
  direction: "inbound" | "outbound";
}) {
  if (input.status === "allowed" && input.flags.length === 0) return;

  await recordLearnMobileActivity({
    schoolId: input.context.schoolId,
    studentId: input.context.studentId,
    accountId: input.context.accountId,
    gradeId: input.context.gradeId,
    classGroupId: input.context.classGroupId,
    eventType: "leo_tutor_message",
    metadata: {
      phase: "safety_review",
      status: input.status,
      flags: input.flags,
      mode: input.mode,
      direction: input.direction,
      conversationId: input.conversationId ? String(input.conversationId) : undefined,
    },
  });
}
