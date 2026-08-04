import { useEffect, useRef, useState } from "react";

/**
 * Reveals an element when it scrolls into view (IntersectionObserver).
 * Falls back to visible when IO is unavailable or reduced motion is on.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(opts?: {
  once?: boolean;
  margin?: string;
  threshold?: number;
}) {
  const { once = true, margin = "0px 0px -10% 0px", threshold = 0.15 } = opts ?? {};
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setInView(true);
      return;
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) obs.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { rootMargin: margin, threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [once, margin, threshold]);

  return { ref, inView };
}
