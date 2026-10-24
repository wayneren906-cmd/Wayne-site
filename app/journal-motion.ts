"use client";

import { useEffect, type RefObject } from "react";

/** Reveal reading blocks once, only after their open entry reaches the viewport. */
export function useJournalMotion(rootRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let dispose = () => {};

    const configure = () => {
      dispose();
      if (reduced.matches || !("IntersectionObserver" in window)) return;

      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRect.height <= 0) continue;
          if (!entry.target.closest("details")?.open) continue;
          entry.target.classList.add("is-journal-revealed");
          observer.unobserve(entry.target);
        }
      }, { rootMargin: "0px 0px -40px 0px", threshold: 0 });

      const discover = () => {
        root.querySelectorAll<HTMLElement>("details[open] [data-journal-reveal]:not(.is-journal-revealed)").forEach(target => observer.observe(target));
      };
      // Records arrive asynchronously; filtering and snapshots can replace them.
      const mutations = new MutationObserver(discover);
      mutations.observe(root, { childList: true, subtree: true });
      const focus = (event: FocusEvent) => {
        const target = event.target instanceof Element ? event.target.closest("[data-journal-reveal]") : null;
        if (target) {
          target.classList.add("is-journal-revealed");
          observer.unobserve(target);
        }
      };
      root.addEventListener("toggle", discover, true);
      root.addEventListener("focusin", focus);
      discover();
      root.classList.add("journal-motion-ready");

      dispose = () => {
        observer.disconnect();
        mutations.disconnect();
        root.removeEventListener("toggle", discover, true);
        root.removeEventListener("focusin", focus);
        root.classList.remove("journal-motion-ready");
      };
    };
    configure();
    reduced.addEventListener("change", configure);
    return () => {
      dispose();
      reduced.removeEventListener("change", configure);
    };
  }, [rootRef]);
}
