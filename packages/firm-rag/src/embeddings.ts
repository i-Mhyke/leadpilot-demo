import {
  createQueryDeadlineSignal,
  readFirmEmbeddingQueryTimeoutMs,
  remainingDeadlineMs,
} from "./timeouts.ts";

const DEFAULT_MODEL = "text-embedding-3-small";
const DEFAULT_DIMENSIONS = 1536;
const DEFAULT_BATCH_SIZE = 96;
const INGESTION_TIMEOUT_MS = 30_000;

export interface EmbeddingConfig {
  apiKey: string;
  model: string;
  dimensions: 1536;
  batchSize: number;
}

export function readEmbeddingConfig(): EmbeddingConfig | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const dimensions = readEmbeddingDimensions();
  if (dimensions === null) {
    return null;
  }

  return {
    apiKey,
    model: process.env.FIRM_KB_EMBEDDING_MODEL ?? DEFAULT_MODEL,
    dimensions,
    batchSize: Number(process.env.FIRM_KB_EMBEDDING_BATCH_SIZE ?? DEFAULT_BATCH_SIZE),
  };
}

export function readEmbeddingDimensions(): 1536 | null {
  const dimensions = Number(process.env.FIRM_KB_EMBEDDING_DIMENSIONS ?? DEFAULT_DIMENSIONS);
  if (dimensions !== 1536) {
    return null;
  }
  return 1536;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  callerSignal?: AbortSignal,
): Promise<Response> {
  const deadline = createQueryDeadlineSignal(timeoutMs, callerSignal);
  try {
    return await fetch(url, { ...init, signal: deadline.signal });
  } finally {
    deadline.cleanup();
  }
}

export async function embedTexts(
  texts: string[],
  config: EmbeddingConfig,
  options?: { ingestion?: boolean; signal?: AbortSignal },
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const timeoutMs = options?.ingestion
    ? INGESTION_TIMEOUT_MS
    : readFirmEmbeddingQueryTimeoutMs();
  const deadlineAtMs = Date.now() + timeoutMs;

  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += config.batchSize) {
    batches.push(texts.slice(i, i + config.batchSize));
  }

  const vectors: number[][] = [];
  for (const batch of batches) {
    let attempt = 0;
  batchRetry: while (true) {
      attempt += 1;
      const remainingMs = remainingDeadlineMs(deadlineAtMs);
      if (remainingMs <= 0) {
        throw Object.assign(new Error("Embedding query deadline exceeded"), {
          name: "EmbeddingQueryDeadlineError",
        });
      }

      const response = await fetchWithTimeout(
        "https://api.openai.com/v1/embeddings",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: config.model,
            input: batch,
            dimensions: config.dimensions,
          }),
        },
        remainingMs,
        options?.signal,
      );

      if (!response.ok) {
        if (isRetryableStatus(response.status) && attempt < 4 && remainingDeadlineMs(deadlineAtMs) > 250) {
          await sleep(250 * attempt + Math.floor(Math.random() * 100));
          continue batchRetry;
        }
        throw new Error(`Embedding request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as {
        data?: Array<{ embedding?: number[] }>;
      };
      const embeddings = payload.data?.map((item) => item.embedding) ?? [];
      if (embeddings.length !== batch.length) {
        throw new Error("Embedding response count mismatch");
      }
      for (const embedding of embeddings) {
        if (!embedding || embedding.length !== config.dimensions) {
          throw new Error("Embedding dimensions mismatch");
        }
        vectors.push(embedding);
      }
      break;
    }
  }

  return vectors;
}

export async function embedQuery(
  query: string,
  config: EmbeddingConfig,
  options?: { signal?: AbortSignal },
): Promise<number[]> {
  const [embedding] = await embedTexts([query], config, options);
  if (!embedding) {
    throw new Error("Query embedding missing");
  }
  return embedding;
}
