import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { ZodType } from "zod";

export type StructuredImportProvider = {
  provider: string;
  completeJson(input: { model: string; context: string; maxTokens: number; responseSchema: ZodType }): Promise<string | null>;
};

export function createOpenAiImportProvider(): StructuredImportProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("IMPORT_AI_PROVIDER_NOT_CONFIGURED");
  return {
    provider: "openai",
    async completeJson(input) {
      const completion = await new OpenAI({ apiKey, timeout: 30_000 }).chat.completions.create({
        model: input.model,
        messages: [
          {
            role: "system",
            content: "You are Leo Import Intelligence. Return only cautious JSON matching the requested schema. Never return MongoDB ids, personal data, or unrequested actions.",
          },
          { role: "user", content: input.context },
        ],
        temperature: 0,
        response_format: zodResponseFormat(input.responseSchema, "leo_import_output"),
        max_tokens: input.maxTokens,
      });
      return completion.choices[0]?.message?.content ?? null;
    },
  };
}
