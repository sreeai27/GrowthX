import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { challengeCapabilityAction, generateReplayAction, getReplayForWorker, submitReplayAction } from "../../actions";
import { ReplayRecorder } from "./replay-recorder";
import { resolveReplaySpeech } from "../../../../../services/providers/replay-speech-provider";

const choices = [
  ["OPEN_TASK_CONFIRM", "Open TaskConfirm and check the booking · बुकिंग जाँचें"],
  ["PROMISE_INCLUDED", "Tell the customer it is included · शामिल होने का वादा करें"],
  ["INVENT_PRICE", "Quote a price from memory · याद से कीमत बताएँ"],
  ["BYPASS_APPROVAL", "Start without customer approval · मंज़ूरी के बिना शुरू करें"],
] as const;

export default async function ReplayPage({ params }: { params: Promise<{ incidentId: string }> }) {
  noStore();
  const { incidentId } = await params;
  const view = await getReplayForWorker(incidentId);
  if (!view) redirect(`/worker/incidents/${incidentId}/completion`);
  if (view.kind === "AVAILABLE") return <main className="incident-shell replay-shell"><article className="replay-card"><p className="eyebrow">Private practice · निजी अभ्यास</p><h1>Practise a changed situation</h1><p lang="hi">उसी सही फैसले का बदली हुई स्थिति में अभ्यास करें।</p><p>This result stays private and is not an external certification.</p><form action={generateReplayAction}><input type="hidden" name="incidentKey" value={incidentId} /><button className="button button-replay">Start practice · अभ्यास शुरू करें</button></form></article></main>;
  const latest = view.attempts.at(-1);
  const audio = await resolveReplaySpeech(view.replay.stimulusText);
  return <main className="incident-shell replay-shell"><header className="incident-topbar"><span className="demo-badge">FICTIONAL DEMO</span><span className="incident-step">REPLAY</span></header><article className="replay-card">
    <p className="eyebrow">Changed situation · बदली हुई स्थिति</p><h1>{view.capability ? "Practice result" : latest ? "Try once more" : "What should you do next?"}</h1>
    {!view.capability ? <blockquote lang="hi">{view.replay.stimulusText}</blockquote> : null}
    {!view.capability ? <audio controls preload="metadata" src={audio.url}>Reviewed transcript: {view.replay.stimulusText}</audio> : null}
    {latest?.correction && !view.capability ? <p className="replay-correction" role="status"><strong>One correction:</strong> {latest.correction}</p> : null}
    {!view.capability ? <><ReplayRecorder incidentKey={incidentId} /><form action={submitReplayAction} className="replay-form"><input type="hidden" name="incidentKey" value={incidentId} /><fieldset><legend>Or choose one next step · या एक अगला कदम चुनें</legend>{choices.map(([value, label]) => <label key={value}><input required type="radio" name="answer" value={value} /> {label}</label>)}</fieldset><button className="button button-replay">Check my answer · जवाब जाँचें</button></form></> : <section className="capability-proof" aria-label="Private capability event"><span className="proof-node" aria-hidden="true" /><div><p className="decision-label">Private capability event · निजी क्षमता रिकॉर्ड</p><h2>{view.capability.result === "DEMONSTRATED" ? "Capability demonstrated" : "Not yet demonstrated"}</h2><p>Assistance: {view.capability.assistanceLevel === "NONE" ? "none" : "one retry"}</p><p>Source {view.capability.sourceId} · v{view.capability.sourceVersion}</p><p>Rubric {view.capability.rubricVersion}</p><p>Model {view.capability.evaluatorModelId} · Prompt {view.capability.promptVersion}</p><p>Private by default · Not an external certification</p></div></section>}
    {view.capability && !view.capability.challenged ? <form action={challengeCapabilityAction}><input type="hidden" name="incidentKey" value={incidentId} /><button className="button button-secondary">Challenge this result · इस नतीजे पर सवाल उठाएँ</button></form> : null}
    {view.capability?.challenged ? <p role="status">Challenge recorded for human review · सवाल जाँच के लिए दर्ज है</p> : null}
  </article></main>;
}
