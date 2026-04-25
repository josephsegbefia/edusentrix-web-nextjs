import "server-only";
import crypto from "crypto";
import type { Types } from "mongoose";
import type { LeoAssistantDraft, LeoToolKey } from "@/lib/leo/types";
import { LeoResponseCache } from "@/models/LeoResponseCache";

type CacheArgs = {
  schoolId: Types.ObjectId;
  toolKey: LeoToolKey;
  route?: string | null;
  userMessage?: string | null;
  ttlSeconds?: number;
};

function normalize(value?: string | null) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function buildCacheKey(args: CacheArgs) {
  const raw = JSON.stringify({
    schoolId: String(args.schoolId),
    toolKey: args.toolKey,
    route: normalize(args.route),
    userMessage: normalize(args.userMessage),
  });
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function withLeoResponseCache(
  args: CacheArgs,
  build: () => Promise<LeoAssistantDraft>
): Promise<LeoAssistantDraft> {
  const cacheKey = buildCacheKey(args);
  const now = new Date();
  const cached = await LeoResponseCache.findOne({
    schoolId: args.schoolId,
    cacheKey,
    expiresAt: { $gt: now },
  }).lean();

  if (cached) {
    return {
      contentText: cached.contentText,
      citations: cached.citations,
      toolsUsed: cached.toolsUsed,
    };
  }

  const draft = await build();
  const ttlSeconds = args.ttlSeconds ?? 300;
  await LeoResponseCache.findOneAndUpdate(
    { schoolId: args.schoolId, cacheKey },
    {
      $set: {
        schoolId: args.schoolId,
        cacheKey,
        toolKey: args.toolKey,
        route: args.route ?? null,
        contentText: draft.contentText,
        citations: draft.citations,
        toolsUsed: draft.toolsUsed,
        expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  return draft;
}
