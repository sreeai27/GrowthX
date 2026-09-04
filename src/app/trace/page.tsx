import { hashDemoToken } from "../../domain/demo-session";
import { getPublicTraceGateway } from "../../services/providers/public-trace";
import { readBrowserCredential } from "../demo/session";
import { TraceEmpty, TraceView } from "./trace-view";

export default async function CurrentTracePage() {
  const credential = await readBrowserCredential();
  if (!credential) return <TraceEmpty />;
  const trace = await getPublicTraceGateway().getCurrent({
    publicRunId: credential.publicRunId,
    browserTokenHash: hashDemoToken(credential.privateToken),
  });
  return trace ? <TraceView current trace={trace} /> : <TraceEmpty />;
}
