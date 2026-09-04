import Link from "next/link";

export default function StudioPage() {
  return (
    <main className="placeholder">
      <p className="eyebrow">Hunar Studio</p>
      <h1>Operational review, with evidence.</h1>
      <p>
        This protected operations surface will grow after the TaskConfirm core
        is persistent.
      </p>
      <p lang="hi">
        TaskConfirm का डेटा सुरक्षित होने के बाद यह संचालन पटल आगे बढ़ेगा।
      </p>
      <Link className="button button-navy" href="/hunar-os">
        Back to Hunar OS
      </Link>
      <Link className="text-link" href="/studio/evals">Open named evaluations</Link>
    </main>
  );
}
