import {
  createQueryDeadlineSignal,
  readLegalEmbeddingQueryTimeoutMs,
  remainingDeadlineMs,
} from "./timeouts.ts";

const EMBEDDING_MODEL = "text-embedding-3-small";

export async function embedQuery(
  query: string,
  options?: { signal?: AbortSignal },
): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const timeoutMs = readLegalEmbeddingQueryTimeoutMs();
  const deadlineAtMs = Date.now() + timeoutMs;
  let attempt = 0;

  while (true) {
    attempt += 1;
    const remainingMs = remainingDeadlineMs(deadlineAtMs);
    if (remainingMs <= 0) return null;

    const deadline = createQueryDeadlineSignal(remainingMs, options?.signal);
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: query,
        }),
        signal: deadline.signal,
      });

      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && attempt < 4 && remainingDeadlineMs(deadlineAtMs) > 250) {
          await sleep(250 * attempt);
          continue;
        }
        return null;
      }

      const payload = (await response.json()) as {
        data?: Array<{ embedding?: number[] }>;
      };

      return payload.data?.[0]?.embedding ?? null;
    } catch (error) {
      if (deadline.timedOut()) return null;
      if (options?.signal?.aborted) throw error;
      if (attempt >= 4 || remainingDeadlineMs(deadlineAtMs) <= 250) return null;
      await sleep(250 * attempt);
    } finally {
      deadline.cleanup();
    }
  }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
