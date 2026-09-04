import Link from "next/link";
import { requireStudioActor } from "./auth/current-actor";
export const dynamic = "force-dynamic";

export default async function StudioPage() {
  await requireStudioActor();
  return (
    <main className="studio-shell studio-home">
      <p className="eyebrow">Hunar Studio</p>
      <h1>Operate the demo with accountable access.</h1>
      <p>
        Named operators work with masked contacts. Separately signed-in platform administrators handle permitted reveals and reviewed deletion requests.
      </p>
      <p lang="hi">
        सामान्य काम में संपर्क जानकारी छिपी रहती है। हर विशेष पहुँच दर्ज की जाती है।
      </p>
      <Link className="button button-navy" href="/studio/contacts">
        Open protected Studio
      </Link>
      <Link className="text-link" href="/studio/evals">Open named evaluations</Link>
    </main>
  );
}
