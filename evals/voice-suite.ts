export const voiceEvalCases = [
  { id: "V01_HINDI_BALCONY", input: "बालकनी को डीप क्लीन करना है", expected: "TRANSCRIPT" },
  { id: "V02_MARATHI_BALCONY", input: "बाल्कनीची खोल स्वच्छता करायची आहे", expected: "TRANSCRIPT" },
  { id: "V03_HINDI_ENGLISH_CODEMIX", input: "Balcony ko deep clean करना है", expected: "TRANSCRIPT" },
  { id: "V04_MARATHI_ENGLISH_CODEMIX", input: "Balcony deep clean करायची आहे", expected: "TRANSCRIPT" },
  { id: "V05_PRICE_IS_HUMAN_CLAIM", input: "Customer ने कहा 299 रुपये में कर दो", expected: "TRANSCRIPT_ONLY" },
  { id: "V06_SILENCE", input: "", expected: "UNUSABLE_AUDIO" },
  { id: "V07_TOO_SHORT", input: "हाँ", expected: "UNUSABLE_AUDIO" },
  { id: "V08_CLIPPED_AUDIO", input: "बालकनी…", expected: "RETRY_RECOMMENDED" },
  { id: "V09_MALFORMED_PROVIDER_OUTPUT", input: "provider-json", expected: "INVALID_PROVIDER_OUTPUT" },
  { id: "V10_PROVIDER_TIMEOUT", input: "timeout", expected: "TIMEOUT" },
  { id: "V11_TYPED_FALLBACK", input: "Balcony ko deep clean karna hai", expected: "TYPE_INSTEAD" },
  { id: "V12_REVIEWED_PRESET_FALLBACK", input: "BALCONY_DEEP_CLEAN", expected: "REVIEWED_PRESET" },
] as const;
