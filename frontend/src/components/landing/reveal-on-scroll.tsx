"use client";

import { useEffect } from "react";

/**
 * Mounts a single IntersectionObserver that flips `.reveal-base` elements
 * to `.active` when they enter the viewport. Re-implements the
 * scroll-triggered animation pattern from the reference design without
 * pulling in a library.
 *
 * Mounted once on the landing-v2 page. The base CSS class hides the element
 * (opacity 0 + a transform) and `.active` removes both — so revealed
 * elements animate in via the spring transition declared in the page.
 */
export function RevealOnScroll() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal-base");
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("active");
            obs.unobserve(e.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
  return null;
}
