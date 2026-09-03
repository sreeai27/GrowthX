import { z } from "zod";

import {
  incidentAudioUploadSchema,
  speechTranscriptSchema,
} from "../../domain/incident-audio";
import { env } from "../../config/env";

export type SpeechTranscript = z.infer<typeof speechTranscriptSchema>;
export type SpeechProviderErrorCode =
  | "UNUSABLE_AUDIO"
  | "TIMEOUT"
  | "PROVIDER_FAILED"
  | "INVALID_PROVIDER_OUTPUT";

export class SpeechProviderError extends Error {
  constructor(
    readonly code: SpeechProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SpeechProviderError";
  }
}

export interface SpeechInput {
  audio: Uint8Array;
  mimeType: "audio/webm" | "audio/mp4" | "audio/mpeg" | "audio/wav" | "audio/ogg";
  durationMs: number;
  languageHint: "unknown" | "hi-IN" | "mr-IN" | "en-IN";
}

export interface SpeechProvider {
  transcribe(input: SpeechInput): Promise<SpeechTranscript>;
}

const fixtureCases = {
  HINDI_CODEMIX: {
    transcript: "बालकनी को deep clean करना है",
    detectedLanguage: "hi-IN",
    languageLabel: "Hindi–English mix",
    quality: "USABLE",
    provider: "fixture",
    model: "fixture-saaras-v3",
  },
  MARATHI: {
    transcript: "बाल्कनीची खोल स्वच्छता करायची आहे",
    detectedLanguage: "mr-IN",
    languageLabel: "Marathi",
    quality: "USABLE",
    provider: "fixture",
    model: "fixture-saaras-v3",
  },
} as const;

export type FixtureSpeechCase = keyof typeof fixtureCases | "SILENCE" | "PROVIDER_FAILURE";

export function createFixtureSpeechProvider(fixture: FixtureSpeechCase): SpeechProvider {
  return {
    async transcribe(input) {
      incidentAudioUploadSchema.parse({
        mimeType: input.mimeType,
        byteLength: input.audio.byteLength,
        durationMs: input.durationMs,
      });
      if (fixture === "SILENCE")
        throw new SpeechProviderError("UNUSABLE_AUDIO", "No usable speech was detected.");
      if (fixture === "PROVIDER_FAILURE")
        throw new SpeechProviderError("PROVIDER_FAILED", "Speech service is unavailable.");
      return speechTranscriptSchema.parse(fixtureCases[fixture]);
    },
  };
}

const sarvamResponseSchema = z
  .object({
    request_id: z.string().min(1),
    transcript: z.string().trim().min(1).max(1_000),
    language_code: z.string().min(2).max(32),
  })
  .passthrough();

function languageLabel(code: string) {
  if (code === "hi-IN") return "Hindi or Hindi code-mix";
  if (code === "mr-IN") return "Marathi or Marathi code-mix";
  if (code === "en-IN") return "Indian English";
  return `Detected language: ${code}`;
}

export function createSarvamSpeechProvider(options: {
  apiKey: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}): SpeechProvider {
  const fetcher = options.fetcher ?? fetch;
  return {
    async transcribe(input) {
      incidentAudioUploadSchema.parse({
        mimeType: input.mimeType,
        byteLength: input.audio.byteLength,
        durationMs: input.durationMs,
      });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
      try {
        const body = new FormData();
        const audioBuffer = new ArrayBuffer(input.audio.byteLength);
        new Uint8Array(audioBuffer).set(input.audio);
        body.set("file", new Blob([audioBuffer], { type: input.mimeType }), `incident.${input.mimeType.split("/")[1]}`);
        body.set("model", "saaras:v3");
        body.set("mode", "transcribe");
        body.set("language_code", input.languageHint);
        const response = await fetcher("https://api.sarvam.ai/speech-to-text", {
          method: "POST",
          headers: { "api-subscription-key": options.apiKey },
          body,
          signal: controller.signal,
        });
        if (!response.ok)
          throw new SpeechProviderError("PROVIDER_FAILED", `Speech service returned HTTP ${response.status}.`);
        const parsed = sarvamResponseSchema.safeParse(await response.json());
        if (!parsed.success)
          throw new SpeechProviderError("INVALID_PROVIDER_OUTPUT", "Speech service returned an invalid response.");
        return speechTranscriptSchema.parse({
          transcript: parsed.data.transcript,
          detectedLanguage: parsed.data.language_code,
          languageLabel: languageLabel(parsed.data.language_code),
          quality: "USABLE",
          provider: "sarvam",
          model: "saaras:v3",
        });
      } catch (error) {
        if (error instanceof SpeechProviderError) throw error;
        if (error instanceof Error && error.name === "AbortError")
          throw new SpeechProviderError("TIMEOUT", "Speech service timed out.");
        throw new SpeechProviderError("PROVIDER_FAILED", "Speech service request failed.");
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export function getSpeechProvider(fixture: FixtureSpeechCase = "HINDI_CODEMIX") {
  if (env.features.fixtureMode) return createFixtureSpeechProvider(fixture);
  if (!env.server.sarvamApiKey)
    throw new SpeechProviderError("PROVIDER_FAILED", "Speech service is not configured.");
  return createSarvamSpeechProvider({ apiKey: env.server.sarvamApiKey });
}
