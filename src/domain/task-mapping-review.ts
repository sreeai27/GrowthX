export interface MappedTaskCandidate {
  readonly taskId: string;
  readonly displayName: string;
  readonly matchReason: string;
}

export interface CatalogueTaskForReview {
  readonly taskId: string;
  readonly displayName: string;
  readonly riskTier: number;
  readonly active: boolean;
}

export function reviewMappedTaskCandidates(
  mapping: {
    readonly candidates: readonly MappedTaskCandidate[];
    readonly shouldAbstain: boolean;
    readonly abstentionReason: string | null;
  },
  catalogue: readonly CatalogueTaskForReview[],
) {
  const activeTasks = new Map(
    catalogue.filter((task) => task.active).map((task) => [task.taskId, task]),
  );
  const hasInvalidCandidate = mapping.candidates.some(
    (candidate) => !activeTasks.has(candidate.taskId),
  );
  const canonicalCandidates = hasInvalidCandidate
    ? []
    : mapping.candidates.map((candidate) => ({
        taskId: candidate.taskId,
        displayName: activeTasks.get(candidate.taskId)!.displayName,
        matchReason: candidate.matchReason,
      }));
  const hasHighRiskCandidate = canonicalCandidates.some(
    (candidate) => activeTasks.get(candidate.taskId)!.riskTier >= 3,
  );
  const requiresReview =
    mapping.shouldAbstain ||
    hasInvalidCandidate ||
    canonicalCandidates.length === 0 ||
    hasHighRiskCandidate;
  const reviewReason = hasInvalidCandidate
    ? "INVALID_CATALOGUE_REFERENCE"
    : hasHighRiskCandidate
      ? "HIGH_RISK_TASK"
      : mapping.abstentionReason ?? "NO_CATALOGUE_MATCH";

  return {
    candidates: requiresReview ? [] : canonicalCandidates,
    requiresReview,
    reviewReason,
  };
}
