"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export default function TextRotate({
  texts,
  interval = 2200,
  className,
}: {
  texts: string[];
  interval?: number;
  className?: string;
}) {
  const safeTexts = useMemo(() => texts.filter(Boolean), [texts]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (safeTexts.length <= 1) return;

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % safeTexts.length);
    }, interval);

    return () => window.clearInterval(timer);
  }, [safeTexts, interval]);

  const current = safeTexts[index] ?? "";

  return (
    <span
      className={cn(
        "inline-flex min-w-[8ch] items-center justify-center rounded-xl bg-[rgb(239,102,46)] px-3 py-1 text-white shadow-[0_10px_28px_rgba(239,102,46,0.18)] transition-all duration-300",
        className,
      )}
    >
      {current}
    </span>
  );
}