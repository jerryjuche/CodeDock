import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";
import type { ButtonSize, ButtonVariant } from "@/components/ui/button";
import {
  buttonBaseClasses,
  variantClasses,
  sizeClasses,
} from "@/components/ui/button";

export interface LinkButtonProps extends Omit<
  React.ComponentPropsWithoutRef<typeof Link>,
  "className"
> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

export function LinkButton({
  children,
  className,
  variant = "default",
  size = "default",
  ...props
}: LinkButtonProps) {
  return (
    <Link
      {...props}
      className={cn(
        buttonBaseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      <span
        className="pointer-events-none absolute inset-0 -translate-x-[120%] bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.16),transparent)] transition-transform duration-700 group-hover:translate-x-[120%]"
        aria-hidden="true"
      />
      <span className="relative z-10">{children}</span>
    </Link>
  );
}

LinkButton.displayName = "LinkButton";

