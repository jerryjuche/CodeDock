import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[18px] border border-white/10 bg-[rgba(8,30,63,0.74)] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl",
        className,
      )}
      {...props}
    />
  );
}