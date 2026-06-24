import type { FirmId } from "./firm.ts";

export interface FirmBrainTone {
  voice?: string;
  formalityLevel?: string;
  preferredGreeting?: string;
  notes: string[];
}

export interface FirmBrainSlots {
  businessSummary?: string;
  tone: FirmBrainTone;
  greeting?: string;
  qualificationPosture: string[];
  qualificationHints?: string[];
  escalationRules: string[];
  forbiddenClaims: string[];
  serviceEmphasis: string[];
  suggestedQuestions?: string[];
}

export interface FirmBrainConfig {
  firmId: FirmId;
  sourceFilename: string;
  rawMarkdown: string;
  contentHash: string;
  revision: number;
  compiled: FirmBrainSlots;
  compiledAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface FirmBrainSnapshot {
  revision: number;
  contentHash: string;
  compiledAt: string;
  compiled: FirmBrainSlots;
}
