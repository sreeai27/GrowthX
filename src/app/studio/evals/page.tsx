import { createFileEvaluationGateway } from "../../../services/providers/evaluation-gateway";
import { requireStudioActor } from "../auth/current-actor";
import { promoteExampleCorrection, runSuite } from "./actions";
export const dynamic = "force-dynamic";

export default async function EvaluationsPage() {
  await requireStudioActor();
  const gateway = createFileEvaluationGateway();
  const [run, promoted] = await Promise.all([gateway.latestRun("demo_sahaay_home_services"), gateway.promoted("demo_sahaay_home_services")]);
  return <main className="trace-page"><p className="eyebrow">Hunar Studio · Evaluations</p><h1>Named release evidence</h1><div className="button-row"><form action={runSuite}><button className="button button-navy" type="submit">Run deterministic suites</button></form><form action={promoteExampleCorrection}><button className="button button-outline" type="submit">Promote corrected case</button></form></div>{promoted.length > 0 && <p>{promoted.length} named regression case promoted.</p>}{run ? <><section className="trace-summary" aria-label="Evaluation summary"><strong>{run.status}</strong><span>{run.aggregate.passed} passed · {run.aggregate.failed} failed</span><code>{run.suiteVersion}</code></section><ul className="trace-timeline" aria-label="Evaluation cases">{run.results.map((result) => <li className="trace-stage" key={result.id}><div><strong>{result.id}: {result.title}</strong><span className="trace-status">{result.pass ? "PASS" : "FAIL"}</span></div><p>{result.criterion}: expected {result.expected}; observed {result.observed}</p><code>{result.latencyMs} ms · ₹{result.costMinor / 100}</code></li>)}</ul></> : <p>No evaluation run has been recorded yet.</p>}</main>;
}
