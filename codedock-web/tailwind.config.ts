import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "Fira Code", "monospace"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        accent: "var(--accent)",
        "accent-2": "var(--accent-2)",
        muted: "var(--muted)",
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        glow: {
          "0%": { opacity: "0.6" },
          "100%": { opacity: "1" },
        },
      },
      boxShadow: {
        "cyan-glow": "0 0 20px rgba(36, 166, 242, 0.3)",
        "orange-glow": "0 0 20px rgba(239, 102, 46, 0.3)",
        "green-glow": "0 0 12px rgba(42, 211, 139, 0.4)",
        "card": "0 16px 40px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
