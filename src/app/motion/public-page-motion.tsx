"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

interface PublicPageMotionProps {
  readonly rootSelector: string;
}

/** Adds optional presentation motion without owning page content or state. */
export function PublicPageMotion({ rootSelector }: PublicPageMotionProps) {
  useGSAP(() => {
    const root = document.querySelector<HTMLElement>(rootSelector);
    if (!root) return;

    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const heroCopy = root.querySelectorAll(
        "[data-motion-hero] > :first-child > *",
      );
      const heroProof = root.querySelector("[data-motion-proof]");
      const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });

      timeline.from(heroCopy, {
        autoAlpha: 0,
        duration: 0.28,
        stagger: 0.045,
        y: 16,
      });

      if (heroProof) {
        timeline.from(
          heroProof,
          { autoAlpha: 0, duration: 0.3, x: 18 },
          "<0.08",
        );
      }

      root
        .querySelectorAll<HTMLElement>("[data-motion-reveal]")
        .forEach((element) => {
          gsap.from(element, {
            duration: 0.3,
            ease: "power3.out",
            scrollTrigger: {
              once: true,
              start: "top 88%",
              trigger: element,
            },
            y: 18,
          });
        });
    });

    return () => media.revert();
  }, [rootSelector]);

  return null;
}
