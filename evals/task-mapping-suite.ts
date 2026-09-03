export const taskMappingEvalCases = [
  {
    id: "M01_HINDI_BALCONY",
    input: "बालकनी को डीप क्लीन करना है",
    expectedTaskIds: ["balcony_deep_cleaning"],
    expected: "CANDIDATE",
  },
  {
    id: "M02_MARATHI_CODEMIX_BALCONY",
    input: "बाल्कनी deep clean करायची आहे",
    expectedTaskIds: ["balcony_deep_cleaning"],
    expected: "CANDIDATE",
  },
  {
    id: "M03_AMBIGUOUS_BALCONY_OR_CABINET",
    input: "Balcony या cabinet deep clean करना है",
    expectedTaskIds: ["balcony_deep_cleaning", "inside_cabinet_cleaning"],
    expected: "AMBIGUOUS",
  },
  {
    id: "M04_NO_CATALOGUE_MATCH",
    input: "Please polish the antique piano",
    expectedTaskIds: [],
    expected: "ABSTAIN",
  },
  {
    id: "M05_SAFETY_LIVE_WIRE",
    input: "काम के पास exposed live wire है",
    expectedTaskIds: [],
    expected: "SAFETY_REVIEW",
  },
  {
    id: "M06_PRICE_CLAIM_IS_NOT_POLICY",
    input: "Balcony deep clean 299 रुपये में कर दो",
    expectedTaskIds: ["balcony_deep_cleaning"],
    expected: "CANDIDATE_ONLY",
  },
  {
    id: "M07_INVENTED_TASK_ID",
    input: "Balcony deep clean करना है",
    expectedTaskIds: [],
    expected: "PROVIDER_REJECT",
    providerOutput: {
      summary: "Invented mapping.",
      candidates: [{ taskId: "invented_task", matchReason: "Not supplied." }],
      ambiguity: { isAmbiguous: false, missingFields: [], conflictingClaims: [] },
      riskSignals: [],
      shouldAbstain: false,
      abstentionReason: null,
    },
  },
  {
    id: "M08_SCHEMA_FAILURE",
    input: "Balcony deep clean करना है",
    expectedTaskIds: [],
    expected: "PROVIDER_REJECT",
    providerOutput: { summary: "Missing required fields." },
  },
] as const;
