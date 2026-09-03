import { describe, expect, it } from "vitest";

import {
  classifyIncidentAudioQuality,
  incidentAudioUploadSchema,
  rawAudioExpiresAt,
  speechTranscriptSchema,
} from "./incident-audio";

describe("incident audio", () => {
  it("accepts a bounded worker recording", () => {
    expect(
      incidentAudioUploadSchema.parse({
        mimeType: "audio/webm",
        byteLength: 48_000,
        durationMs: 8_000,
      }),
    ).toEqual({ mimeType: "audio/webm", byteLength: 48_000, durationMs: 8_000 });
  });

  it("rejects unsupported or excessive uploads", () => {
    expect(() =>
      incidentAudioUploadSchema.parse({ mimeType: "audio/x-wav", byteLength: 48_000, durationMs: 8_000 }),
    ).toThrow();
    expect(() =>
      incidentAudioUploadSchema.parse({ mimeType: "audio/webm", byteLength: 5_000_001, durationMs: 8_000 }),
    ).toThrow();
    expect(() =>
      incidentAudioUploadSchema.parse({ mimeType: "audio/webm", byteLength: 48_000, durationMs: 30_001 }),
    ).toThrow();
  });

  it("classifies short and silent recordings without inventing text", () => {
    expect(classifyIncidentAudioQuality({ durationMs: 900, speechDetected: true, clippingDetected: false })).toBe("UNUSABLE");
    expect(classifyIncidentAudioQuality({ durationMs: 8_000, speechDetected: false, clippingDetected: false })).toBe("UNUSABLE");
    expect(classifyIncidentAudioQuality({ durationMs: 8_000, speechDetected: true, clippingDetected: true })).toBe("RETRY_RECOMMENDED");
    expect(classifyIncidentAudioQuality({ durationMs: 8_000, speechDetected: true, clippingDetected: false })).toBe("USABLE");
  });

  it("strictly validates native transcript evidence", () => {
    expect(
      speechTranscriptSchema.parse({
        transcript: "बालकनी को डीप क्लीन करना है",
        detectedLanguage: "hi-IN",
        languageLabel: "Hindi–English mix",
        quality: "USABLE",
        provider: "fixture",
        model: "fixture-saaras-v3",
      }),
    ).toMatchObject({ provider: "fixture", quality: "USABLE" });
    expect(() =>
      speechTranscriptSchema.parse({
        transcript: "",
        detectedLanguage: "hi-IN",
        languageLabel: "Hindi",
        quality: "USABLE",
        provider: "fixture",
        model: "fixture-saaras-v3",
        confidence: 0.94,
      }),
    ).toThrow();
  });

  it("expires raw worker audio after 24 hours", () => {
    expect(rawAudioExpiresAt("2026-09-03T00:00:00.000Z")).toBe("2026-09-04T00:00:00.000Z");
  });
});
