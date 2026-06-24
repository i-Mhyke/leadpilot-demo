import { exactSearchChunks, expandGraphNeighbors, relaxedLexicalSearchChunks, semanticSearchChunks } from "@leadpilot/db";
import type { LegalSearchResult } from "./types.ts";

export async function semanticSearch(input: {
  queryEmbedding: number[];
  limit: number;
  firmId: string;
}): Promise<LegalSearchResult[]> {
  const rows = await semanticSearchChunks({
    embedding: input.queryEmbedding,
    limit: input.limit,
    firmId: input.firmId,
  });

  return rows.map((row) => ({
    chunkId: row.chunk_id,
    parentUnitId: row.parent_unit_id,
    documentId: row.document_id ?? row.parent_unit_id,
    citation: row.citation,
    sourceFile: row.source_file,
    text: row.text,
    similarity: row.similarity,
  }));
}

export async function exactSearch(input: {
  query: string;
  limit: number;
  firmId: string;
}): Promise<LegalSearchResult[]> {
  const rows = await exactSearchChunks(input);

  return rows.map((row) => ({
    chunkId: row.chunk_id,
    parentUnitId: row.parent_unit_id,
    documentId: row.document_id ?? row.parent_unit_id,
    citation: row.citation,
    sourceFile: row.source_file,
    text: row.text,
    exactMatchScore: row.exact_match_score,
  }));
}

export async function relaxedLexicalSearch(input: {
  tsQuery: string;
  limit: number;
  firmId: string;
}): Promise<LegalSearchResult[]> {
  const rows = await relaxedLexicalSearchChunks(input);

  return rows.map((row) => ({
    chunkId: row.chunk_id,
    parentUnitId: row.parent_unit_id,
    documentId: row.document_id ?? row.parent_unit_id,
    citation: row.citation,
    sourceFile: row.source_file,
    text: row.text,
    exactMatchScore: row.exact_match_score,
  }));
}

export async function expandGraph(input: {
  chunkIds: string[];
  limit: number;
  firmId: string;
}): Promise<LegalSearchResult[]> {
  const rows = await expandGraphNeighbors(input);

  return rows.map((row) => ({
    chunkId: row.chunk_id,
    parentUnitId: row.parent_unit_id,
    documentId: row.document_id ?? row.parent_unit_id,
    citation: row.citation,
    sourceFile: row.source_file,
    text: row.text,
    relationshipType: row.relationship_type,
    relationshipReason: row.relationship_reason,
  }));
}
