import { z } from "zod";

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional(),
);

const optionalSecret = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const environmentSchema = z.object({
  NEXT_PUBLIC_CONVEX_URL: optionalUrl,
  OPENAI_API_KEY: optionalSecret,
  SARVAM_API_KEY: optionalSecret,
  FEATURE_VOICE_CAPTURE: z.enum(["true", "false"]).default("false"),
  FEATURE_OPENAI_MAPPING: z.enum(["true", "false"]).default("false"),
});

export function parseEnvironment(input: Record<string, string | undefined>) {
  const parsed = environmentSchema.parse(input);

  return {
    public: parsed.NEXT_PUBLIC_CONVEX_URL
      ? { convexUrl: parsed.NEXT_PUBLIC_CONVEX_URL }
      : undefined,
    server: {
      ...(parsed.OPENAI_API_KEY ? { openAiApiKey: parsed.OPENAI_API_KEY } : {}),
      ...(parsed.SARVAM_API_KEY ? { sarvamApiKey: parsed.SARVAM_API_KEY } : {}),
    },
    features: {
      voiceCapture: parsed.FEATURE_VOICE_CAPTURE === "true",
      openAiMapping: parsed.FEATURE_OPENAI_MAPPING === "true",
    },
  };
}

export const env = parseEnvironment(process.env);
