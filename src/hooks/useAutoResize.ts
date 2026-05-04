import { useEffect, useRef } from "react";

/**
 * Auto-resizes a textarea to fit its content (no internal scroll).
 * Returns a ref to attach to the <textarea>.
 */
export function useAutoResize<T extends HTMLTextAreaElement = HTMLTextAreaElement>(
  value: string,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return ref;
}
