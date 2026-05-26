import "server-only";

import OpenAI from "openai";

import {
  buildExplorePromptPair,
  buildExploreRepairSystemPrompt,
  buildExploreRepairUserPrompt,
  EXPLORE_AI_PROMPT_VERSION,
} from "@/lib/learn/explore/explore-prompts";
import type { ExploreAiGenerationOutput } from "@/lib/learn/explore/explore-schemas";
import { validateExploreAiOutput } from "@/lib/learn/explore/explore-schemas";
import { buildExploreTemplateFallback } from "@/lib/learn/explore/explore-template-fallback";
import type {
  ExploreGenerationMode,
  ResolvedExploreGenerationContext,
} from "@/lib/learn/explore/explore-types";

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TEMPERATURE = 0.85;

export function isExploreAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function generateExploreAiContent(input: {
  context: ResolvedExploreGenerationContext;
  mode: ExploreGenerationMode;
}): Promise<
  | {
      ok: true;
      output: ExploreAiGenerationOutput;
      provider: string;
      model: string;
      promptVersion: string;
      temperature: number;
      usedTemplateFallback: boolean;
    }
  | { ok: false; error: string }
> {
  if (!isExploreAiConfigured()) {
    return {
      ok: true,
      output: buildExploreTemplateFallback(input.context),
      provider: "template",
      model: "deterministic-fallback",
      promptVersion: EXPLORE_AI_PROMPT_VERSION,
      temperature: 0,
      usedTemplateFallback: true,
    };
  }

  const prompts = buildExplorePromptPair({
    context: input.context,
    mode: input.mode,
  });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      temperature: DEFAULT_TEMPERATURE,
      response_format: { type: "json_object" },
      max_tokens: 4200,
      messages: [
        { role: "system", content: prompts.systemPrompt },
        { role: "user", content: prompts.userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return { ok: false, error: "Empty AI response" };
    }

    const parsed = JSON.parse(raw) as unknown;
    const validated = validateExploreAiOutput(parsed);
    if (!validated.ok) {
      return { ok: false, error: validated.message };
    }

    return {
      ok: true,
      output: validated.data,
      provider: "openai",
      model: DEFAULT_MODEL,
      promptVersion: prompts.promptVersion,
      temperature: DEFAULT_TEMPERATURE,
      usedTemplateFallback: false,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Explore AI generation failed",
    };
  }
}

export async function repairExploreAiContent(input: {
  content: ExploreAiGenerationOutput;
  failedChecks: string[];
  context: ResolvedExploreGenerationContext;
}): Promise<
  | { ok: true; output: ExploreAiGenerationOutput }
  | { ok: false; error: string }
> {
  if (!isExploreAiConfigured()) {
    return { ok: false, error: "AI repair unavailable without OpenAI configuration" };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
      max_tokens: 4200,
      messages: [
        { role: "system", content: buildExploreRepairSystemPrompt() },
        {
          role: "user",
          content: buildExploreRepairUserPrompt({
            contentJson: JSON.stringify(input.content),
            failedChecks: input.failedChecks,
            lessonTitle: input.context.lessonTitle,
            gradeName: input.context.gradeName,
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return { ok: false, error: "Empty repair response" };
    }

    const validated = validateExploreAiOutput(JSON.parse(raw) as unknown);
    if (!validated.ok) {
      return { ok: false, error: validated.message };
    }

    return { ok: true, output: validated.data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Explore AI repair failed",
    };
  }
}
