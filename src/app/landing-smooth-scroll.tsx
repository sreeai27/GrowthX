"use client";

import { useEffect } from "react";

export function LandingSmoothScroll() {
  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let cancelled = false;
    let destroyLenis: (() => void) | undefined;

    const syncPreference = async () => {
      destroyLenis?.();
      destroyLenis = undefined;

      if (reducedMotion.matches) {
        return;
      }

      const { default: Lenis } = await import("lenis");

      if (cancelled || reducedMotion.matches) {
        return;
      }

      const lenis = new Lenis({
        anchors: true,
        autoRaf: true,
      });

      destroyLenis = () => lenis.destroy();
    };

    void syncPreference();
    reducedMotion.addEventListener("change", syncPreference);

    return () => {
      cancelled = true;
      reducedMotion.removeEventListener("change", syncPreference);
      destroyLenis?.();
    };
  }, []);

  return null;
}
