"use client";

import Silk from "@/components/reactbits/silk";

export default function SilkHero() {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[20px]">
      <Silk
        speed={4}
        scale={1}
        color="#2FCBFF"
        noiseIntensity={1.15}
        rotation={0}
        className="h-full w-full"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(1,26,61,0.08),rgba(1,26,61,0.82))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(239,102,46,0.18),transparent_24%)]" />
    </div>
  );
}