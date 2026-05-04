// components/ui/badge.tsx
import * as React from "react";

export function Badge({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-[rgb(158,183,211)] ${className}`}
      {...props}
    />
  );
}