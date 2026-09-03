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
  OPENAI_MODEL_INTERPRETER: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).default("gpt-5.6-terra"),
  ),
  SARVAM_API_KEY: optionalSecret,
  DEMO_SESSION_COOKIE_SECRET: optionalSecret,
  FEATURE_VOICE_CAPTURE: z.enum(["true", "false"]).default("false"),
  FEATURE_OPENAI_MAPPING: z.enum(["true", "false"]).default("false"),
  FEATURE_FIXTURE_MODE: z.enum(["true", "false"]).default("false"),
  DEMO_FIXTURE_STORE_PATH: optionalSecret,
  DEMO_CONTACT_ENCRYPTION_KEY: optionalSecret,
  PRIVATE_RESULT_DELIVERY_PROVIDER: z
    .enum(["DEMONSTRATION"])
    .optional(),
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
      ...(parsed.DEMO_SESSION_COOKIE_SECRET
        ? { demoSessionCookieSecret: parsed.DEMO_SESSION_COOKIE_SECRET }
        : {}),
      ...(parsed.DEMO_CONTACT_ENCRYPTION_KEY
        ? { demoContactEncryptionKey: parsed.DEMO_CONTACT_ENCRYPTION_KEY }
        : {}),
      ...(parsed.PRIVATE_RESULT_DELIVERY_PROVIDER
        ? { privateResultDeliveryProvider: parsed.PRIVATE_RESULT_DELIVERY_PROVIDER }
        : {}),
    },
    features: {
      voiceCapture: parsed.FEATURE_VOICE_CAPTURE === "true",
      openAiMapping: parsed.FEATURE_OPENAI_MAPPING === "true",
      fixtureMode: parsed.FEATURE_FIXTURE_MODE === "true",
    },
    models: { interpreter: parsed.OPENAI_MODEL_INTERPRETER },
    fixtureStorePath: parsed.DEMO_FIXTURE_STORE_PATH,
  };
}

export const env = parseEnvironment(process.env);
