"use client";

import { useEffect, type RefObject } from "react";

/** Pointer motion only schedules a frame when the pointer actually moves. */
export function useHomeMotion(rootRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let dispose = () => {};

    const configure = () => {
      dispose();
      if (reduced.matches) return;
      const ambient = root.querySelector<HTMLElement>(".contact-replica-section");
      const observer = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
        for (const entry of entries) entry.target.classList.toggle("is-in-view", entry.isIntersecting);
      }, { threshold: 0 }) : null;
      if (ambient) observer?.observe(ambient);

      // A section's top edge can appear well before its large headline.
      // Reveal each line only after most of that line is inside the viewport.
      const contactObserver = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= .6) {
            entry.target.classList.add("is-contact-ready");
            contactObserver?.unobserve(entry.target);
          }
        }
      }, { threshold: .6, rootMargin: "0px 0px -72px 0px" }) : null;
      root.querySelectorAll(".contact-title-line, .contact-replica-subinvite, .contact-action-col").forEach(target => {
        if (!target.classList.contains("is-contact-ready")) contactObserver?.observe(target);
      });

      const photo = finePointer.matches ? root.querySelector<HTMLElement>(".pub-cover-photo .pub-photo-window") : null;
      let frame = 0;
      let x = 0, y = 0;
      const reset = () => {
        window.cancelAnimationFrame(frame);
        frame = 0;
        for (const name of ["--motion-x", "--motion-y", "--motion-rx", "--motion-ry"]) photo?.style.removeProperty(name);
      };
      const move = (event: PointerEvent) => {
        if (event.pointerType !== "mouse" || !photo) return;
        const rect = photo.getBoundingClientRect();
        x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
        y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
        if (frame) return;
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          photo.style.setProperty("--motion-x", `${(x * 4).toFixed(2)}px`);
          photo.style.setProperty("--motion-y", `${(y * 3).toFixed(2)}px`);
          photo.style.setProperty("--motion-rx", `${(-y * .7).toFixed(2)}deg`);
          photo.style.setProperty("--motion-ry", `${(x * .9).toFixed(2)}deg`);
        });
      };
      const hide = () => {
        const hidden = document.visibilityState !== "visible";
        ambient?.classList.toggle("motion-page-paused", hidden);
        if (hidden) reset();
      };
      photo?.addEventListener("pointermove", move, { passive: true });
      photo?.addEventListener("pointerleave", reset);
      photo?.addEventListener("pointercancel", reset);
      document.addEventListener("visibilitychange", hide);
      hide();
      dispose = () => {
        observer?.disconnect();
        contactObserver?.disconnect();
        ambient?.classList.remove("is-in-view");
        ambient?.classList.remove("motion-page-paused");
        photo?.removeEventListener("pointermove", move);
        photo?.removeEventListener("pointerleave", reset);
        photo?.removeEventListener("pointercancel", reset);
        document.removeEventListener("visibilitychange", hide);
        reset();
      };
    };
    configure();
    reduced.addEventListener("change", configure);
    finePointer.addEventListener("change", configure);
    return () => {
      dispose();
      reduced.removeEventListener("change", configure);
      finePointer.removeEventListener("change", configure);
    };
  }, [rootRef]);
}
