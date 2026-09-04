import { notFound } from "next/navigation";

import { getPublicTraceGateway } from "../../../services/providers/public-trace";
import { TraceView } from "../trace-view";

export default async function CuratedTracePage({
  params,
}: {
  readonly params: Promise<{ exampleId: string }>;
}) {
  const { exampleId } = await params;
  const trace = await getPublicTraceGateway().getCurated(exampleId);
  if (!trace) notFound();
  return <TraceView activeId={exampleId} trace={trace} />;
}
