"use client";

import { useRef, useState } from "react";

import { captureVoiceAction } from "../../actions";

type RecorderState = "IDLE" | "PERMISSION_DENIED" | "READY" | "RECORDING" | "PREVIEW" | "PROCESSING";

export function VoiceRecorder({ incidentKey }: { incidentKey: string }) {
  const [state, setState] = useState<RecorderState>("IDLE");
  const [elapsed, setElapsed] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function enableMicrophone() {
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      setState("READY");
    } catch {
      setState("PERMISSION_DENIED");
    }
  }

  function beginRecording() {
    if (!stream.current || state !== "READY") return;
    const chunks: BlobPart[] = [];
    const next = new MediaRecorder(stream.current, { mimeType: "audio/webm" });
    recorder.current = next;
    startedAt.current = Date.now();
    setElapsed(0);
    next.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    next.onstop = () => {
      if (timer.current) clearInterval(timer.current);
      const clip = new Blob(chunks, { type: next.mimeType || "audio/webm" });
      setAudio(clip);
      setDurationMs(Date.now() - startedAt.current);
      setPreviewUrl(URL.createObjectURL(clip));
      setState("PREVIEW");
    };
    next.start();
    timer.current = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt.current) / 1_000);
      setElapsed(seconds);
      if (seconds >= 15 && next.state === "recording") next.stop();
    }, 250);
    setState("RECORDING");
  }

  function stopRecording() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  function cancel() {
    if (recorder.current?.state === "recording") recorder.current.stop();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setAudio(null);
    setPreviewUrl(null);
    setElapsed(0);
    setDurationMs(0);
    setState(stream.current ? "READY" : "IDLE");
  }

  async function upload() {
    if (!audio) return;
    setState("PROCESSING");
    const form = new FormData();
    form.set("incidentKey", incidentKey);
    form.set("durationMs", String(durationMs));
    form.set("audio", new File([audio], "worker-retelling.webm", { type: audio.type || "audio/webm" }));
    await captureVoiceAction(form);
  }

  return (
    <section className="voice-capture" aria-labelledby="voice-capture-title">
      <div className="voice-proof-node" aria-hidden="true" />
      <div>
        <p className="eyebrow">Worker voice · कार्यकर्ता की आवाज़</p>
        <h2 id="voice-capture-title">Tell us what the customer asked for</h2>
        <p>Record your own description of the request. Do not record the customer or their home without permission.</p>
        <p lang="hi">केवल अपनी आवाज़ में अनुरोध बताएँ। बिना अनुमति ग्राहक या उनके घर को रिकॉर्ड न करें।</p>
        <p className="voice-guidance">Speak for 5–15 seconds in Hindi, Marathi or a mix.</p>
        <div aria-live="polite" className="voice-status">
          {state === "IDLE" ? "Microphone permission not requested" : null}
          {state === "PERMISSION_DENIED" ? "Microphone permission denied. Type or use a reviewed example below." : null}
          {state === "READY" ? "Microphone ready. Recording has not started." : null}
          {state === "RECORDING" ? `Recording · ${elapsed}s` : null}
          {state === "PREVIEW" ? "Recording stopped. Review before upload." : null}
          {state === "PROCESSING" ? "Processing securely…" : null}
        </div>
        {state === "IDLE" || state === "PERMISSION_DENIED" ? (
          <button className="secondary-button" onClick={enableMicrophone} type="button">Enable microphone · माइक्रोफ़ोन चालू करें</button>
        ) : null}
        {state === "READY" || state === "RECORDING" ? (
          <button className="voice-record-button" onPointerDown={beginRecording} onPointerUp={stopRecording} onPointerCancel={stopRecording} type="button">Hold to record · दबाकर बोलें</button>
        ) : null}
        {state === "RECORDING" ? (
          <button className="secondary-button" onClick={cancel} type="button">Cancel recording · रिकॉर्डिंग रद्द करें</button>
        ) : null}
        {state === "PREVIEW" && previewUrl ? (
          <div className="voice-preview">
            <audio controls src={previewUrl}>Your browser cannot preview this recording.</audio>
            <button className="button button-teal" onClick={upload} type="button">Use recording · रिकॉर्डिंग इस्तेमाल करें</button>
            <button className="secondary-button" onClick={cancel} type="button">Try recording again · फिर रिकॉर्ड करें</button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
