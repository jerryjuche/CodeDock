"use client";

import { useEffect, useMemo, useRef } from "react";

type SilkProps = {
  speed?: number;
  scale?: number;
  color?: string;
  noiseIntensity?: number;
  rotation?: number;
  className?: string;
};

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;

  const int = parseInt(value, 16);

  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

export default function Silk({
  speed = 4,
  scale = 1,
  color = "#2FCBFF",
  noiseIntensity = 1.15,
  rotation = 0,
  className,
}: SilkProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rgb = useMemo(() => hexToRgb(color), [color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let frame = 0;
    let animationFrame = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      context.clearRect(0, 0, width, height);
      context.save();

      context.translate(width / 2, height / 2);
      context.rotate((rotation * Math.PI) / 180);
      context.translate(-width / 2, -height / 2);

      for (let layer = 0; layer < 16; layer++) {
        const offset = layer * 18 * scale;
        const alpha = 0.05 + layer * 0.018;

        context.beginPath();

        for (let x = -40; x <= width + 40; x += 6) {
          const waveA =
            Math.sin((x + frame * speed + offset) * 0.008 * scale) * 18;
          const waveB =
            Math.cos((x - frame * speed * 0.7 + offset) * 0.014 * scale) * 10;
          const noise =
            Math.sin((x + layer * 21 + frame * 0.9) * 0.022) *
            8 *
            noiseIntensity;
          const y = height * 0.52 + offset - layer * 10 + waveA + waveB + noise;

          if (x === -40) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        }

        context.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
        context.lineWidth = 1.2;
        context.stroke();
      }

      context.restore();

      frame += 0.7;
      animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    draw();

    const observer = new ResizeObserver(() => resize());
    observer.observe(canvas);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [rgb, rotation, scale, speed, noiseIntensity]);

  return <canvas ref={canvasRef} className={className ?? "h-full w-full"} />;
}