"use client";

import { useRef, useState } from "react";
import { submitReplayVoiceAction } from "../../actions";

export function ReplayRecorder({ incidentKey }: { incidentKey: string }) {
  const [status, setStatus] = useState<"IDLE" | "READY" | "RECORDING" | "PREVIEW" | "DENIED" | "PROCESSING">("IDLE");
  const stream = useRef<MediaStream | null>(null), recorder = useRef<MediaRecorder | null>(null), startedAt = useRef(0);
  const [clip, setClip] = useState<Blob | null>(null);
  async function enable() { try { stream.current = await navigator.mediaDevices.getUserMedia({ audio: true }); setStatus("READY"); } catch { setStatus("DENIED"); } }
  function start() { if (!stream.current || status !== "READY") return; const chunks: BlobPart[] = [], next = new MediaRecorder(stream.current, { mimeType: "audio/webm" }); recorder.current = next; startedAt.current = Date.now(); next.ondataavailable = event => { if (event.data.size) chunks.push(event.data); }; next.onstop = () => { setClip(new Blob(chunks, { type: next.mimeType || "audio/webm" })); setStatus("PREVIEW"); }; next.start(); setStatus("RECORDING"); }
  function stop() { if (recorder.current?.state === "recording") recorder.current.stop(); }
  async function submit() { if (!clip) return; setStatus("PROCESSING"); const form = new FormData(); form.set("incidentKey", incidentKey); form.set("durationMs", String(Math.max(1_000, Date.now() - startedAt.current))); form.set("audio", new File([clip], "replay-answer.webm", { type: clip.type })); await submitReplayVoiceAction(form); }
  return <section className="voice-capture" aria-label="Answer by voice"><p className="eyebrow">Answer by voice · आवाज़ में जवाब</p><p aria-live="polite">{status === "IDLE" ? "Microphone permission not requested" : status === "DENIED" ? "Microphone denied. Choose an answer below." : status === "READY" ? "Ready to record" : status === "RECORDING" ? "Recording" : status === "PREVIEW" ? "Recording ready" : "Checking answer"}</p>{status === "IDLE" || status === "DENIED" ? <button type="button" className="secondary-button" onClick={enable}>Enable microphone · माइक्रोफ़ोन चालू करें</button> : null}{status === "READY" || status === "RECORDING" ? <button type="button" className="voice-record-button" onPointerDown={start} onPointerUp={stop} onPointerCancel={stop}>Hold to answer · दबाकर जवाब दें</button> : null}{status === "PREVIEW" ? <button type="button" className="button button-replay" onClick={submit}>Use voice answer · आवाज़ वाला जवाब भेजें</button> : null}</section>;
}
