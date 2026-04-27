import * as React from "react";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none ring-0 placeholder:text-zinc-500 focus:border-zinc-600"
      {...props}
    />
  );
}
