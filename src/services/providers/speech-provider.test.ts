import { describe, expect, it, vi } from "vitest";

import {
  SpeechProviderError,
  createFixtureSpeechProvider,
  createSarvamSpeechProvider,
} from "./speech-provider";

const input = {
  audio: new Uint8Array([1, 2, 3]),
  mimeType: "audio/webm" as const,
  durationMs: 8_000,
  languageHint: "unknown" as const,
};

describe("SpeechProvider", () => {
  it("returns deterministic native fixture evidence", async () => {
    await expect(createFixtureSpeechProvider("HINDI_CODEMIX").transcribe(input)).resolves.toEqual({
      transcript: "बालकनी को deep clean करना है",
      detectedLanguage: "hi-IN",
      languageLabel: "Hindi–English mix",
      quality: "USABLE",
      provider: "fixture",
      model: "fixture-saaras-v3",
    });
  });

  it("reports silence without a fabricated transcript", async () => {
    await expect(createFixtureSpeechProvider("SILENCE").transcribe(input)).rejects.toMatchObject({
      code: "UNUSABLE_AUDIO",
    });
  });

  it("validates Sarvam output before returning it", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ request_id: "req_1", transcript: "बालकनी साफ करनी है", language_code: "hi-IN" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const result = await createSarvamSpeechProvider({ apiKey: "secret", fetcher }).transcribe(input);
    expect(result).toMatchObject({ transcript: "बालकनी साफ करनी है", provider: "sarvam", model: "saaras:v3" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("rejects malformed provider output", async () => {
    const provider = createSarvamSpeechProvider({
      apiKey: "secret",
      fetcher: vi.fn().mockResolvedValue(new Response(JSON.stringify({ transcript: "" }), { status: 200 })),
    });
    const transcription = provider.transcribe(input);
    await expect(transcription).rejects.toBeInstanceOf(SpeechProviderError);
    await expect(transcription).rejects.toMatchObject({ code: "INVALID_PROVIDER_OUTPUT" });
  });

  it("maps aborts and provider failures to safe codes", async () => {
    const timeout = createSarvamSpeechProvider({
      apiKey: "secret",
      fetcher: vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" })),
    });
    await expect(timeout.transcribe(input)).rejects.toMatchObject({ code: "TIMEOUT" });

    const failed = createSarvamSpeechProvider({
      apiKey: "secret",
      fetcher: vi.fn().mockResolvedValue(new Response("no", { status: 503 })),
    });
    await expect(failed.transcribe(input)).rejects.toMatchObject({ code: "PROVIDER_FAILED" });
  });
});
