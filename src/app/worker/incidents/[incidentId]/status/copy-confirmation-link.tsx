"use client";

import { useState } from "react";

export function CopyConfirmationLink({ href }: { href: string }) {
  const [feedback, setFeedback] = useState<"idle" | "copied" | "error">("idle");

  async function copyLink() {
    try {
      const absoluteUrl = new URL(href, window.location.origin).toString();
      await navigator.clipboard.writeText(absoluteUrl);
      setFeedback("copied");
    } catch {
      setFeedback("error");
    }
  }

  return (
    <div className="copy-confirmation-control">
      <button className="secondary-button" type="button" onClick={copyLink}>
        Copy customer link · ग्राहक लिंक कॉपी करें
      </button>
      <p aria-live="polite" className="copy-feedback">
        {feedback === "copied"
          ? "Link copied · लिंक कॉपी हुआ"
          : feedback === "error"
            ? "Could not copy. Open the link and copy it from the browser. · कॉपी नहीं हुआ। लिंक खोलें।"
            : ""}
      </p>
    </div>
  );
}
