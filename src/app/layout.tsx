import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "@fontsource/anek-devanagari/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/700.css";
import "@fontsource/noto-sans/400.css";
import "@fontsource/noto-sans/700.css";
import "@fontsource/noto-sans-devanagari/400.css";
import "lenis/dist/lenis.css";
import "../config/env";
import "./styles.css";

export const metadata: Metadata = {
  title: { default: "Hunar OS", template: "%s · Hunar OS" },
  description: "Source-backed exception resolution for frontline work.",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = {
  themeColor: "#fcfbf7",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
