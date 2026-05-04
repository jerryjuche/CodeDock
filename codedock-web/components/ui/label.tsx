import * as React from "react";
import { cn } from "@/lib/utils";

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        "mb-2 inline-block text-sm font-medium text-[rgb(234,244,255)]",
        className,
      )}
      {...props}
    />
  );
}