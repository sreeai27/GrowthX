import { z } from "zod";

const generatedAudioSchema = z.object({ url: z.string().url(), provider: z.string(), modelId: z.string() }).strict();
export type GeneratedReplaySpeech = (text: string) => Promise<unknown>;

export interface ReplayAudioResult {
  url: string;
  source: "GENERATED" | "REVIEWED_FALLBACK";
  provider: string;
  modelId: string;
}

export async function resolveReplaySpeech(text: string, generate?: GeneratedReplaySpeech): Promise<ReplayAudioResult> {
  if (generate) {
    try {
      const audio = generatedAudioSchema.parse(await generate(text));
      return { ...audio, source: "GENERATED" };
    } catch {
      // Speech is optional; the reviewed local asset keeps practice available.
    }
  }
  return { url: "/audio/taskconfirm-balcony-reviewed.wav", source: "REVIEWED_FALLBACK", provider: "REVIEWED_FIXTURE", modelId: "reviewed-audio-v1" };
}
