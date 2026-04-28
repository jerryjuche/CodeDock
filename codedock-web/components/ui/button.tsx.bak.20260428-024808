import * as React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
};

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonProps) {
  const variants: Record<string, string> = {
    primary: "bg-white text-black hover:bg-zinc-200",
    secondary: "border border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800",
    danger: "bg-red-600 text-white hover:bg-red-500"
  };

  return (
    <button
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
