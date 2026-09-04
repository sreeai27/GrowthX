import { describe, expect, it } from "vitest";
import { resolveReplaySpeech } from "./replay-speech-provider";

describe("replay speech provider", () => {
  it("cannot block replay when generated speech fails", async () => {
    await expect(resolveReplaySpeech("practice", async () => { throw new Error("offline"); })).resolves.toMatchObject({ source: "REVIEWED_FALLBACK", url: "/audio/taskconfirm-balcony-reviewed.wav" });
  });
});
