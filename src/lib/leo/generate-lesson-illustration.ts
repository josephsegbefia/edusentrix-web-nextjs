import "server-only";

import OpenAI from "openai";
import { trackUsage } from "@/lib/billing/trackUsage";
import {
  buildImageGenerationPrompt,
  buildScenePlannerUserPrompt,
  parseIllustrationScenePlan,
  SCENE_PLANNER_SYSTEM,
  type IllustrationScenePlan,
} from "@/lib/lessons/lesson-illustration-planning";
import {
  uploadLessonIllustrationBuffer,
  uploadLessonIllustrationFromUrl,
} from "@/lib/uploads/lesson-illustration-upload";
import type mongoose from "mongoose";

const LEO_PLANNER_MODEL_DEFAULT = "gpt-4o-mini" as const;
const LEO_IMAGE_MODEL_DEFAULT = "gpt-image-2" as const;

const IMAGE_MODEL_FALLBACKS = [
  "gpt-image-2",
  "gpt-image-1-mini",
  "gpt-image-1",
] as const;

type ImageModel = (typeof IMAGE_MODEL_FALLBACKS)[number] | "gpt-image-1.5";
type PlannerModel = "gpt-4o-mini" | "gpt-4o";
type ImageQuality = "low" | "medium" | "high" | "auto";

function resolvePlannerModels(): PlannerModel[] {
  const configured = process.env.OPENAI_ILLUSTRATION_MODEL?.trim();
  if (configured === "gpt-4o") return ["gpt-4o", "gpt-4o-mini"];
  if (configured === "gpt-4o-mini") return ["gpt-4o-mini"];
  return [LEO_PLANNER_MODEL_DEFAULT];
}

function resolveImageModels(): ImageModel[] {
  const configured = process.env.OPENAI_IMAGE_MODEL?.trim();
  const ordered = configured
    ? [configured as ImageModel, ...IMAGE_MODEL_FALLBACKS.filter((m) => m !== configured)]
    : [LEO_IMAGE_MODEL_DEFAULT, ...IMAGE_MODEL_FALLBACKS.filter((m) => m !== LEO_IMAGE_MODEL_DEFAULT)];
  return [...new Set(ordered)];
}

function resolveImageQuality(): ImageQuality {
  const configured = process.env.OPENAI_IMAGE_QUALITY?.trim();
  if (configured === "low" || configured === "medium" || configured === "high" || configured === "auto") {
    return configured;
  }
  return "high";
}

function isModelAccessError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("does not have access to model") ||
    message.includes("model_not_found") ||
    message.includes("must be verified") ||
    message.includes("permission") ||
    message.includes("403")
  );
}

function isPngBuffer(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  );
}

async function withModelFallback<T, M extends string>(
  models: M[],
  run: (model: M) => Promise<T>,
): Promise<{ result: T; model: M }> {
  let lastError: unknown = null;
  for (const model of models) {
    try {
      return { result: await run(model), model };
    } catch (error) {
      lastError = error;
      if (!isModelAccessError(error)) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Model unavailable.");
}

async function planIllustrationScene(
  openai: OpenAI,
  model: PlannerModel,
  input: {
    fact?: string;
    detail?: string;
    prompt?: string;
    sessionTitle?: string;
  },
): Promise<IllustrationScenePlan | null> {
  const userPrompt = buildScenePlannerUserPrompt(input);
  if (!userPrompt) return null;

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SCENE_PLANNER_SYSTEM },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.5,
    response_format: { type: "json_object" },
    max_tokens: 3500,
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) return null;

  try {
    return parseIllustrationScenePlan(JSON.parse(text));
  } catch {
    return null;
  }
}

async function generatePngIllustration(
  openai: OpenAI,
  model: ImageModel,
  prompt: string,
): Promise<{ buffer?: Buffer; remoteUrl?: string } | null> {
  const response = await openai.images.generate({
    model,
    prompt,
    size: "1024x1536",
    quality: resolveImageQuality(),
    output_format: "png",
  });

  const first = response.data?.[0];
  const b64 = first?.b64_json;
  const remoteUrl = first?.url;

  if (b64) {
    const buffer = Buffer.from(b64, "base64");
    if (!isPngBuffer(buffer)) {
      throw new Error("Image model returned data that is not a PNG.");
    }
    return { buffer };
  }
  if (remoteUrl) {
    return { remoteUrl };
  }
  return null;
}

function hasFactCardContext(input: { fact?: string; detail?: string }): boolean {
  return Boolean(input.fact?.trim() && input.detail?.trim());
}

function hasPromptContext(input: { prompt?: string }): boolean {
  return Boolean(input.prompt?.trim() && input.prompt.trim().length >= 8);
}

export async function generateLessonIllustrationDraft(input: {
  schoolId: mongoose.Types.ObjectId;
  prompt?: string;
  fact?: string;
  detail?: string;
  sessionTitle?: string;
}): Promise<
  | { ok: true; imageUrl: string; uploadThingKey: string; generationPrompt: string }
  | { ok: false; error: string }
> {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: "OpenAI is not configured." };
  }

  if (!hasFactCardContext(input) && !hasPromptContext(input)) {
    return { ok: false, error: "Provide a fact card or illustration prompt." };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const plannerModels = resolvePlannerModels();
  const imageModels = resolveImageModels();

  let scenePlan: IllustrationScenePlan | null = null;
  let aiCallCount = 0;
  let renderNote = "unknown";

  try {
    const planned = await withModelFallback(plannerModels, (model) =>
      planIllustrationScene(openai, model, input),
    );
    scenePlan = planned.result;
    aiCallCount += 1;
    renderNote = `plan:${planned.model}`;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not plan illustration.",
    };
  }

  if (!scenePlan) {
    return { ok: false, error: "Leo could not plan an illustration for this fact card." };
  }

  const imagePrompt = buildImageGenerationPrompt(scenePlan);

  let pngBuffer: Buffer | null = null;
  let lastImageError: string | null = null;

  try {
    const generated = await withModelFallback(imageModels, (model) =>
      generatePngIllustration(openai, model, imagePrompt),
    );
    aiCallCount += 1;
    renderNote = `png:${generated.model}`;

    if (generated.result.buffer) {
      pngBuffer = generated.result.buffer;
    } else if (generated.result.remoteUrl) {
      const fileName = `leo-illustration-${Date.now()}.png`;
      const uploaded = await uploadLessonIllustrationFromUrl({
        schoolId: input.schoolId,
        url: generated.result.remoteUrl,
        fileName,
      });

      await trackUsage({
        schoolId: input.schoolId,
        provider: "openai",
        metricKey: "ai_calls",
        quantity: aiCallCount,
        unitLabel: "calls",
        allocationMethod: "direct",
        sourceType: "manual",
        notes: `Leo lesson illustration draft (${renderNote}, ${aiCallCount} steps).`,
      });

      return {
        ok: true,
        imageUrl: uploaded.url,
        uploadThingKey: uploaded.key,
        generationPrompt: scenePlan.generationPrompt,
      };
    } else {
      lastImageError = "Image model returned no PNG data.";
    }
  } catch (error) {
    lastImageError = error instanceof Error ? error.message : "Image generation failed.";
  }

  if (!pngBuffer) {
    return {
      ok: false,
      error:
        lastImageError ??
        "Could not generate a PNG illustration. Check that your OpenAI project has gpt-image-2 access.",
    };
  }

  try {
    const fileName = `leo-illustration-${Date.now()}.png`;
    const uploaded = await uploadLessonIllustrationBuffer({
      schoolId: input.schoolId,
      buffer: pngBuffer,
      fileName,
      mimeType: "image/png",
    });

    await trackUsage({
      schoolId: input.schoolId,
      provider: "openai",
      metricKey: "ai_calls",
      quantity: aiCallCount,
      unitLabel: "calls",
      allocationMethod: "direct",
      sourceType: "manual",
      notes: `Leo lesson illustration draft (${renderNote}, ${aiCallCount} steps).`,
    });

    return {
      ok: true,
      imageUrl: uploaded.url,
      uploadThingKey: uploaded.key,
      generationPrompt: scenePlan.generationPrompt,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not store illustration draft.",
    };
  }
}
