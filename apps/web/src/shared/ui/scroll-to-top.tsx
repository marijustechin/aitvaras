"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const SHOW_AFTER_PX = 320;

/** The nearest vertically scrollable container, or null for the document. */
function scrollContainer(): HTMLElement | null {
  let element = document.querySelector<HTMLElement>("main");
  while (element) {
    const style = window.getComputedStyle(element);
    if (
      /(auto|scroll)/.test(style.overflowY) &&
      element.scrollHeight > element.clientHeight + 1
    ) {
      return element;
    }
    element = element.parentElement;
  }
  return null;
}

function canScrollVertically(container: HTMLElement | null): boolean {
  return container
    ? container.scrollHeight > container.clientHeight + 1
    : document.documentElement.scrollHeight > window.innerHeight + 1;
}

function currentScrollTop(container: HTMLElement | null): number {
  return container ? container.scrollTop : window.scrollY;
}

/**
 * Shared global "Į viršų" button.
 *
 * Appears only when the actual page scroll container has vertical overflow and
 * the user has moved down; updates on scroll, resize, route changes and content
 * height changes. Uses instant scrolling when reduced motion is requested.
 */
export function ScrollToTop() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function update(): void {
      const container = scrollContainer();
      setVisible(
        canScrollVertically(container) &&
          currentScrollTop(container) > SHOW_AFTER_PX,
      );
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    const main = document.querySelector("main");
    if (main) {
      observer.observe(main);
    }

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, [pathname]);

  function toTop(): void {
    const container = scrollContainer();
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const behavior: ScrollBehavior = reducedMotion ? "auto" : "smooth";
    if (container) {
      container.scrollTo({ top: 0, behavior });
      return;
    }
    window.scrollTo({ top: 0, behavior });
  }

  if (!visible) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Į viršų"
      title="Į viršų"
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-black bg-white text-black shadow-md hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:right-6"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <path d="M12 19V5" />
        <path d="m6 11 6-6 6 6" />
      </svg>
    </button>
  );
}
