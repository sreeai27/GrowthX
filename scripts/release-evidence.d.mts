export type ReleaseEvidenceInput = {
  commit: string;
  generatedAt: string;
  fixtures: Record<string, unknown>;
  evalStore: Record<string, unknown>;
  checks?: Record<string, string>;
};
export function buildReleaseEvidence(input: ReleaseEvidenceInput): Record<string, unknown>;
