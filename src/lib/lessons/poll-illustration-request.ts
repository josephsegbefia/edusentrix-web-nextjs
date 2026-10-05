export type IllustrationRequestDto = {
  id: string;
  status: string;
  imageUrl: string | null;
  uploadThingKey: string | null;
  generationPrompt: string | null;
  lastError: string | null;
};

export async function enqueueAndPollIllustrationDraft(body: {
  prompt?: string;
  fact?: string;
  detail?: string;
  sessionTitle?: string;
  regenerate?: boolean;
}): Promise<IllustrationRequestDto> {
  const res = await fetch("/api/leo/lessons/generate-illustration-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as {
    success?: boolean;
    error?: string;
    data?: { illustrationRequestId?: string };
  } | null;
  if (!res.ok || !json?.success || !json.data?.illustrationRequestId) {
    throw new Error(json?.error || "Could not start illustration generation.");
  }
  return pollIllustrationRequest(json.data.illustrationRequestId);
}

export async function pollIllustrationRequest(
  illustrationRequestId: string,
  options?: { intervalMs?: number; timeoutMs?: number }
): Promise<IllustrationRequestDto> {
  const intervalMs = options?.intervalMs ?? 2500;
  const timeoutMs = options?.timeoutMs ?? 4 * 60_000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = await fetch(`/api/leo/lessons/illustration-requests/${illustrationRequestId}`, {
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      throw new Error(json?.error || "Failed to load illustration draft");
    }
    const data = json.data as IllustrationRequestDto;
    if (data.status === "succeeded" && data.imageUrl) return data;
    if (data.status === "failed" || data.status === "cancelled") {
      throw new Error(data.lastError || "Illustration generation failed");
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Illustration is still generating. Check back from notifications.");
}
