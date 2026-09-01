import Link from "next/link";

export default function DemoPage() {
  return (
    <main className="placeholder">
      <p className="eyebrow">Guided demo</p>
      <h1>TaskConfirm starts here.</h1>
      <p>The isolated demo session arrives in the next implementation phase.</p>
      <p lang="hi">अलग और सुरक्षित डेमो सत्र अगले चरण में जोड़ा जाएगा।</p>
      <Link className="button button-teal" href="/kaam-saathi">
        Back to KaamSaathi
      </Link>
    </main>
  );
}
