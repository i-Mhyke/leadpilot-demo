import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import {
  HARD_MAX_TOKENS,
  MAX_CHUNKS_PER_SOURCE,
  MAX_MANIFEST_BYTES,
  MAX_METADATA_BYTES,
  MAX_METADATA_DEPTH,
  MAX_METADATA_KEYS,
  MAX_SOURCE_BYTES,
  SPLIT_OVERLAP_TOKENS,
  TARGET_TOKENS,
  type FirmContentType,
  type FirmKnowledgeManifest,
  type FirmKnowledgeSource,
  type PreparedFirmChunk,
  firmKnowledgeManifestSchema,
} from "./types.ts";

export class FirmManifestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirmManifestValidationError";
  }
}

export function normalizeMarkdown(content: string): string {
  const withoutBom = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  return withoutBom.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function normalizeSourceUri(uri: string | undefined): string | null {
  if (!uri) return null;
  try {
    return new URL(uri).toString();
  } catch {
    throw new FirmManifestValidationError("sourceUri must be an absolute URL");
  }
}

export function normalizeEffectiveAt(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new FirmManifestValidationError("effectiveAt must be a valid ISO timestamp");
  }
  return date.toISOString();
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep(record[key]);
        return acc;
      }, {});
  }
  return value;
}

export function buildContentHashEnvelope(input: {
  schemaVersion: number;
  firmDisplayName: string;
  sourceKey: string;
  title: string;
  sourceType: string;
  sourceUri: string | null;
  effectiveAt: string | null;
  metadata: Record<string, unknown>;
  contentMarkdown: string;
}): string {
  const canonical = sortKeysDeep({
    schemaVersion: input.schemaVersion,
    firmDisplayName: input.firmDisplayName,
    sourceKey: input.sourceKey,
    title: input.title,
    sourceType: input.sourceType,
    sourceUri: input.sourceUri,
    effectiveAt: input.effectiveAt,
    metadata: input.metadata,
    contentMarkdown: input.contentMarkdown,
  });
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function buildChunkId(input: {
  firmSlug: string;
  sourceKey: string;
  contentHash: string;
  embeddingModel: string;
  embeddingDimensions: number;
  headingPath: string[];
  chunkIndex: number;
}): string {
  const material = [
    input.firmSlug,
    input.sourceKey,
    input.contentHash,
    input.embeddingModel,
    String(input.embeddingDimensions),
    input.headingPath.join(" > "),
    String(input.chunkIndex),
  ].join("|");
  return createHash("sha256").update(material).digest("hex");
}

export function classifyContentType(headingPath: string[], body: string): FirmContentType {
  const joined = headingPath.join(" ").toLowerCase();
  if (/team|people|lawyer|partner|associate|co-founder|founder/.test(joined)) {
    return "person";
  }
  if (/publication|insight|article|blog|press|media/.test(joined)) {
    return "publication";
  }
  if (/contact|address|email|phone/.test(joined)) {
    return "contact";
  }
  if (/compliance|certification|ndpa|ndpr|regulatory/.test(joined)) {
    return "compliance";
  }
  if (/positioning|selling point|what we do|mission|vision|overview|company/.test(joined)) {
    return joined.includes("service") || joined.includes("practice") ? "service" : "positioning";
  }
  if (/service|practice area|technology|corporate|dispute|innovation/.test(joined)) {
    return "service";
  }
  if (/^#\s/.test(body) && headingPath.length === 0) {
    return "overview";
  }
  return "other";
}

function isPersonSection(headingPath: string[]): boolean {
  const joined = headingPath.join(" ").toLowerCase();
  return /team|people|lawyer|partner|associate|co-founder|operations/.test(joined);
}

interface MarkdownSection {
  headingPath: string[];
  body: string;
}

function parseMarkdownSections(markdown: string): MarkdownSection[] {
  const lines = markdown.split("\n");
  const sections: MarkdownSection[] = [];
  let currentPath: string[] = [];
  let currentBody: string[] = [];

  const flush = () => {
    const body = currentBody.join("\n").trim();
    if (body) {
      sections.push({ headingPath: [...currentPath], body });
    }
    currentBody = [];
  };

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flush();
      const level = headingMatch[1]!.length;
      const title = headingMatch[2]!.trim();
      currentPath = currentPath.slice(0, level - 1);
      currentPath[level - 1] = title;
      continue;
    }
    currentBody.push(line);
  }
  flush();

  if (sections.length === 0 && markdown.trim()) {
    sections.push({ headingPath: [], body: markdown.trim() });
  }

  return sections;
}

function splitOversizedText(text: string, overlapTokens: number): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const parts: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current.trim()) {
      parts.push(current.trim());
      current = "";
    }
  };

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (estimateTokens(candidate) <= HARD_MAX_TOKENS) {
      current = candidate;
      continue;
    }
    pushCurrent();
    if (estimateTokens(paragraph) <= HARD_MAX_TOKENS) {
      current = paragraph;
      continue;
    }
    const words = paragraph.split(/\s+/);
    let chunk = "";
    for (const word of words) {
      const next = chunk ? `${chunk} ${word}` : word;
      if (estimateTokens(next) > HARD_MAX_TOKENS) {
        if (chunk) parts.push(chunk);
        chunk = word;
      } else {
        chunk = next;
      }
    }
    if (chunk) {
      current = chunk;
    }
  }
  pushCurrent();

  if (parts.length === 0) {
    return enforceHardTokenLimit(text);
  }

  if (parts.length <= 1 || overlapTokens <= 0) {
    return parts.flatMap((part) => enforceHardTokenLimit(part));
  }

  const overlapped: string[] = [parts[0]!];
  for (let i = 1; i < parts.length; i++) {
    const prev = parts[i - 1]!;
    const prevWords = prev.split(/\s+/);
    const overlapWordCount = Math.max(1, overlapTokens * 4);
    let tailWords = prevWords.slice(-overlapWordCount);
    let merged = `${tailWords.join(" ")}\n\n${parts[i]}`;
    while (estimateTokens(merged) > HARD_MAX_TOKENS && tailWords.length > 1) {
      tailWords = tailWords.slice(1);
      merged = `${tailWords.join(" ")}\n\n${parts[i]}`;
    }
    overlapped.push(
      estimateTokens(merged) > HARD_MAX_TOKENS ? parts[i]! : merged,
    );
  }
  return overlapped.flatMap((part) => enforceHardTokenLimit(part));
}

function enforceHardTokenLimit(text: string): string[] {
  if (estimateTokens(text) <= HARD_MAX_TOKENS) {
    return [text];
  }
  const words = text.split(/\s+/).filter(Boolean);
  const parts: string[] = [];
  let chunk = "";
  for (const word of words) {
    const next = chunk ? `${chunk} ${word}` : word;
    if (estimateTokens(next) > HARD_MAX_TOKENS) {
      if (chunk) parts.push(chunk);
      chunk = word;
    } else {
      chunk = next;
    }
  }
  if (chunk) parts.push(chunk);
  return parts;
}

function chunkSection(section: MarkdownSection): string[] {
  const tokens = estimateTokens(section.body);
  if (tokens <= HARD_MAX_TOKENS) {
    return [section.body];
  }
  if (isPersonSection(section.headingPath) && tokens <= HARD_MAX_TOKENS) {
    return [section.body];
  }
  if (isPersonSection(section.headingPath)) {
    return splitOversizedText(section.body, 0);
  }
  if (tokens <= TARGET_TOKENS * 2) {
    return splitOversizedText(section.body, SPLIT_OVERLAP_TOKENS);
  }
  return splitOversizedText(section.body, SPLIT_OVERLAP_TOKENS);
}

export function buildEmbeddingPrefix(input: {
  firmDisplayName: string;
  title: string;
  contentType: FirmContentType;
  headingPath: string[];
}): string {
  const path = input.headingPath.length > 0 ? input.headingPath.join(" > ") : "root";
  return `${input.firmDisplayName} | ${input.title} | ${input.contentType} | ${path}`;
}

export function chunkFirmSource(input: {
  manifest: FirmKnowledgeManifest;
  source: FirmKnowledgeSource;
  contentMarkdown: string;
  embeddingModel: string;
  embeddingDimensions: 1536;
}): PreparedFirmChunk[] {
  const normalized = normalizeMarkdown(input.contentMarkdown);
  const contentHash = buildContentHashEnvelope({
    schemaVersion: input.manifest.schemaVersion,
    firmDisplayName: input.manifest.firmDisplayName,
    sourceKey: input.source.sourceKey,
    title: input.source.title,
    sourceType: input.source.sourceType,
    sourceUri: normalizeSourceUri(input.source.sourceUri),
    effectiveAt: normalizeEffectiveAt(input.source.effectiveAt),
    metadata: input.source.metadata ?? {},
    contentMarkdown: normalized,
  });

  const sections = parseMarkdownSections(normalized);
  const rawChunks: Array<{ headingPath: string[]; body: string; contentType: FirmContentType }> =
    [];

  for (const section of sections) {
    const contentType = classifyContentType(section.headingPath, section.body);
    for (const body of chunkSection(section)) {
      rawChunks.push({ headingPath: section.headingPath, body, contentType });
    }
  }

  if (rawChunks.length > MAX_CHUNKS_PER_SOURCE) {
    throw new FirmManifestValidationError(`Source exceeds ${MAX_CHUNKS_PER_SOURCE} chunks`);
  }

  const chunkCount = rawChunks.length;
  return rawChunks.map((chunk, index) => {
    const chunkIndex = index + 1;
    const prefix = buildEmbeddingPrefix({
      firmDisplayName: input.manifest.firmDisplayName,
      title: input.source.title,
      contentType: chunk.contentType,
      headingPath: chunk.headingPath,
    });
    const id = buildChunkId({
      firmSlug: input.manifest.firmSlug,
      sourceKey: input.source.sourceKey,
      contentHash,
      embeddingModel: input.embeddingModel,
      embeddingDimensions: input.embeddingDimensions,
      headingPath: chunk.headingPath,
      chunkIndex,
    });
    return {
      id,
      chunkIndex,
      chunkCount,
      headingPath: chunk.headingPath,
      contentType: chunk.contentType,
      chunkText: chunk.body,
      textHash: hashText(chunk.body),
      estimatedTokens: estimateTokens(chunk.body),
      embeddingText: `${prefix}\n\n${chunk.body}`,
      metadata: input.source.metadata ?? {},
    };
  });
}

function validateMetadata(value: Record<string, unknown>, path = "metadata"): void {
  const keys = Object.keys(value);
  if (keys.length > MAX_METADATA_KEYS) {
    throw new FirmManifestValidationError(`Too many metadata keys at ${path}`);
  }
  const serialized = JSON.stringify(value);
  if (serialized.length > MAX_METADATA_BYTES) {
    throw new FirmManifestValidationError(`Metadata exceeds ${MAX_METADATA_BYTES} bytes`);
  }
  const depth = (obj: unknown, current = 1): number => {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      return current;
    }
    const children = Object.values(obj as Record<string, unknown>);
    if (children.length === 0) return current;
    return Math.max(...children.map((child) => depth(child, current + 1)));
  };
  if (depth(value) > MAX_METADATA_DEPTH) {
    throw new FirmManifestValidationError(`Metadata nesting exceeds depth ${MAX_METADATA_DEPTH}`);
  }
}

export async function loadAndValidateManifest(manifestPath: string): Promise<{
  manifest: FirmKnowledgeManifest;
  manifestDir: string;
}> {
  const manifestRaw = await readFile(manifestPath, "utf8");
  if (manifestRaw.length > MAX_MANIFEST_BYTES) {
    throw new FirmManifestValidationError(`Manifest exceeds ${MAX_MANIFEST_BYTES} bytes`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(manifestRaw);
  } catch {
    throw new FirmManifestValidationError("Manifest must be valid JSON");
  }

  if (parsed && typeof parsed === "object" && "firmId" in parsed) {
    throw new FirmManifestValidationError("firmId is not allowed in manifest");
  }

  const manifest = firmKnowledgeManifestSchema.parse(parsed);
  const manifestDir = dirname(resolve(manifestPath));

  for (const source of manifest.sources) {
    validateMetadata(source.metadata ?? {});
    const sourcePath = resolve(manifestDir, source.path);
    const relativePath = relative(manifestDir, sourcePath);
    if (relativePath.startsWith("..") || relativePath.includes(`${".."}/`)) {
      throw new FirmManifestValidationError("Source path must stay within manifest directory");
    }
    const content = await readFile(sourcePath, "utf8");
    if (content.length > MAX_SOURCE_BYTES) {
      throw new FirmManifestValidationError(`Source ${source.sourceKey} exceeds ${MAX_SOURCE_BYTES} bytes`);
    }
  }

  return { manifest, manifestDir };
}

export async function prepareManifestSource(input: {
  manifestPath: string;
  sourceKey?: string;
  embeddingModel: string;
  embeddingDimensions: 1536;
}): Promise<
  Array<{
    manifest: FirmKnowledgeManifest;
    source: FirmKnowledgeSource;
    contentMarkdown: string;
    contentHash: string;
    chunks: PreparedFirmChunk[];
  }>
> {
  const { manifest, manifestDir } = await loadAndValidateManifest(input.manifestPath);
  const sources = input.sourceKey
    ? manifest.sources.filter((source) => source.sourceKey === input.sourceKey)
    : manifest.sources;

  if (input.sourceKey && sources.length === 0) {
    throw new FirmManifestValidationError(`Unknown sourceKey: ${input.sourceKey}`);
  }

  const prepared = [];
  for (const source of sources) {
    const contentMarkdown = normalizeMarkdown(
      await readFile(resolve(manifestDir, source.path), "utf8"),
    );
    const contentHash = buildContentHashEnvelope({
      schemaVersion: manifest.schemaVersion,
      firmDisplayName: manifest.firmDisplayName,
      sourceKey: source.sourceKey,
      title: source.title,
      sourceType: source.sourceType,
      sourceUri: normalizeSourceUri(source.sourceUri),
      effectiveAt: normalizeEffectiveAt(source.effectiveAt),
      metadata: source.metadata ?? {},
      contentMarkdown,
    });
    const chunks = chunkFirmSource({
      manifest,
      source,
      contentMarkdown,
      embeddingModel: input.embeddingModel,
      embeddingDimensions: input.embeddingDimensions,
    });
    prepared.push({ manifest, source, contentMarkdown, contentHash, chunks });
  }
  return prepared;
}
