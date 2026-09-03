import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VoiceRecorder } from "./voice-recorder";

vi.mock("../../actions", () => ({ captureVoiceAction: vi.fn() }));

describe("VoiceRecorder", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
  });

  it("never requests microphone permission on page load", () => {
    render(<VoiceRecorder incidentKey="inc_voice_123" />);
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(screen.getByText(/permission not requested/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /Enable microphone/i })).toBeVisible();
  });

  it("shows safe typed and preset recovery when permission is denied", async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
    render(<VoiceRecorder incidentKey="inc_voice_123" />);
    fireEvent.click(screen.getByRole("button", { name: /Enable microphone/i }));
    await waitFor(() => expect(screen.getByText(/permission denied/i)).toBeVisible());
    expect(screen.getByText(/Type or use a reviewed example/i)).toBeVisible();
  });
});
