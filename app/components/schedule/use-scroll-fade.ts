"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useScrollFade(deps: unknown[] = []) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);

  const checkOverflow = useCallback(() => {
    const element = scrollRef.current;
    if (!element) {
      setShowFade(false);
      return;
    }

    const hasOverflow = element.scrollHeight > element.clientHeight + 1;
    const isScrolledToBottom =
      element.scrollTop + element.clientHeight >= element.scrollHeight - 1;

    setShowFade(hasOverflow && !isScrolledToBottom);
  }, []);

  useEffect(() => {
    checkOverflow();

    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const resizeObserver = new ResizeObserver(checkOverflow);
    resizeObserver.observe(element);

    element.addEventListener("scroll", checkOverflow, { passive: true });
    window.addEventListener("resize", checkOverflow);

    return () => {
      resizeObserver.disconnect();
      element.removeEventListener("scroll", checkOverflow);
      window.removeEventListener("resize", checkOverflow);
    };
  }, [checkOverflow, ...deps]);

  return { scrollRef, showFade };
}
