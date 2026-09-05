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
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
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

const forbiddenPublicSecrets = [
  "NEXT_PUBLIC_OPENAI_API_KEY",
  "NEXT_PUBLIC_SARVAM_API_KEY",
  "NEXT_PUBLIC_DEMO_SESSION_COOKIE_SECRET",
  "NEXT_PUBLIC_DEMO_CONTACT_ENCRYPTION_KEY",
] as const;

export function parseEnvironment(input: Record<string, string | undefined>) {
  const exposedSecret = forbiddenPublicSecrets.find((name) => input[name]);
  if (exposedSecret) throw new Error(`${exposedSecret} must remain server-only.`);
  const parsed = environmentSchema.parse(input);
  if (parsed.NODE_ENV === "production") {
    const missing = [
      !parsed.NEXT_PUBLIC_CONVEX_URL ? "NEXT_PUBLIC_CONVEX_URL" : null,
      !parsed.DEMO_SESSION_COOKIE_SECRET || parsed.DEMO_SESSION_COOKIE_SECRET.length < 32 ? "DEMO_SESSION_COOKIE_SECRET (at least 32 characters)" : null,
      !parsed.DEMO_CONTACT_ENCRYPTION_KEY || parsed.DEMO_CONTACT_ENCRYPTION_KEY.length < 32 ? "DEMO_CONTACT_ENCRYPTION_KEY (at least 32 characters)" : null,
    ].filter(Boolean);
    if (missing.length) throw new Error(`Production configuration requires: ${missing.join(", ")}.`);
    if (parsed.FEATURE_FIXTURE_MODE === "true") throw new Error("FEATURE_FIXTURE_MODE must be false in production.");
  }

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
