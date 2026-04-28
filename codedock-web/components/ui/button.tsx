import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "outline" | "secondary" | "ghost" | "destructive";
type ButtonSize = "default" | "sm" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  default:
    "bg-[rgb(239,102,46)] text-white shadow-[0_10px_24px_rgba(239,102,46,0.22)] hover:bg-[rgb(249,145,53)]",
  outline:
    "border border-white/15 bg-white/5 text-white hover:bg-white/10",
  secondary:
    "bg-[rgba(36,166,242,0.14)] text-[rgb(234,244,255)] hover:bg-[rgba(36,166,242,0.22)]",
  ghost:
    "bg-transparent text-[rgb(234,244,255)] hover:bg-white/6",
  destructive:
    "bg-[rgba(255,90,107,0.18)] text-white hover:bg-[rgba(255,90,107,0.28)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-11 px-4 text-sm",
  sm: "h-9 px-3 text-sm",
  lg: "h-12 px-6 text-base",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "group relative inline-flex items-center justify-center overflow-hidden rounded-[12px] font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
          "hover:-translate-y-[1px] active:translate-y-0",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        <span
          className="pointer-events-none absolute inset-0 -translate-x-[120%] bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.16),transparent)] transition-transform duration-700 group-hover:translate-x-[120%]"
          aria-hidden="true"
        />
        <span className="relative z-10">{children}</span>
      </button>
    );
  },
);

Button.displayName = "Button";