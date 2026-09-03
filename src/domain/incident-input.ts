export const REVIEWED_REQUEST_PRESETS = {
  BALCONY_DEEP_CLEAN: "Customer asked for balcony deep cleaning.",
  BOOKING_MISMATCH: "Customer says the booking is different.",
  SAFETY_CONCERN: "There is an exposed live wire near the work area.",
} as const;

export type ReviewedPresetKey = keyof typeof REVIEWED_REQUEST_PRESETS;

export interface CatalogueTaskForMapping {
  readonly taskId: string;
  readonly displayName: string;
  readonly riskTier: number;
  readonly active: boolean;
}

const reviewedTaskTerms: ReadonlyArray<{
  taskId: string;
  terms: readonly string[];
}> = [
  { taskId: "balcony_deep_cleaning", terms: ["balcony", "बालकनी", "बाल्कनी"] },
  { taskId: "inside_cabinet_cleaning", terms: ["cabinet", "कैबिनेट"] },
  { taskId: "wardrobe_assembly", terms: ["wardrobe", "almari", "अलमारी"] },
  {
    taskId: "exposed_live_wire_response",
    terms: ["live wire", "electric wire", "बिजली का तार"],
  },
  { taskId: "bathroom_cleaning_standard_1", terms: ["bathroom", "बाथरूम"] },
  { taskId: "floor_cleaning_standard", terms: ["floor", "फर्श", "पोछा"] },
  { taskId: "kitchen_surface_cleaning", terms: ["kitchen", "किचन"] },
];

export function normaliseWorkerText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function resolveReviewedPreset(key: string): string | undefined {
  return REVIEWED_REQUEST_PRESETS[key as ReviewedPresetKey];
}

export function mapReviewedTaskCandidates(
  confirmedText: string,
  catalogue: readonly CatalogueTaskForMapping[],
) {
  const lowerText = confirmedText.toLocaleLowerCase();
  const candidates = reviewedTaskTerms
    .filter(({ terms }) => terms.some((term) => lowerText.includes(term)))
    .map(({ taskId }) => catalogue.find((task) => task.taskId === taskId && task.active))
    .filter((task): task is CatalogueTaskForMapping => Boolean(task))
    .slice(0, 3)
    .map((task) => ({
      taskId: task.taskId,
      displayName: task.displayName,
      matchReason: "Matches reviewed words in the confirmed request.",
      riskTier: task.riskTier,
    }));
  return {
    candidates,
    requiresReview:
      candidates.length === 0 || candidates.some((candidate) => candidate.riskTier >= 3),
  };
}
