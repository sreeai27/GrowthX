import { z } from "zod";

const supportedAudioMimeTypeSchema = z.enum([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
]);

export const incidentAudioUploadSchema = z
  .object({
    mimeType: supportedAudioMimeTypeSchema,
    byteLength: z.number().int().positive().max(5_000_000),
    durationMs: z.number().int().positive().max(30_000),
  })
  .strict();

export const speechTranscriptSchema = z
  .object({
    transcript: z.string().trim().min(1).max(1_000),
    detectedLanguage: z.string().trim().min(2).max(32),
    languageLabel: z.string().trim().min(2).max(80),
    quality: z.enum(["USABLE", "RETRY_RECOMMENDED"]),
    provider: z.string().trim().min(1).max(80),
    model: z.string().trim().min(1).max(120),
  })
  .strict();

export type IncidentAudioQuality =
  | "USABLE"
  | "RETRY_RECOMMENDED"
  | "UNUSABLE";

export function classifyIncidentAudioQuality(input: {
  durationMs: number;
  speechDetected: boolean;
  clippingDetected: boolean;
}): IncidentAudioQuality {
  if (input.durationMs < 1_500 || !input.speechDetected) return "UNUSABLE";
  if (input.clippingDetected || input.durationMs < 5_000)
    return "RETRY_RECOMMENDED";
  return "USABLE";
}

export function rawAudioExpiresAt(capturedAt: string): string {
  const capturedTime = z.string().datetime().parse(capturedAt);
  return new Date(Date.parse(capturedTime) + 24 * 60 * 60 * 1_000).toISOString();
}
