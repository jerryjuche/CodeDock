import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-11 w-full rounded-[12px] border border-white/12 bg-[rgba(255,255,255,0.04)] px-4 py-2 text-sm text-white outline-none transition-all",
          "placeholder:text-[rgb(158,183,211)]",
          "focus:border-[rgba(36,166,242,0.55)] focus:bg-[rgba(255,255,255,0.06)] focus:ring-2 focus:ring-[rgba(36,166,242,0.16)]",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";