"use client";

import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

interface LoadingStateProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingState({
  message = "Loading...",
  size = "md",
  className = "",
}: LoadingStateProps) {
  return (
    <Card className={`p-6 text-center ${className}`}>
      <div className="flex flex-col items-center gap-4">
        <Spinner size={size} />
        <p className="text-sm text-[rgb(158,183,211)]">{message}</p>
      </div>
    </Card>
  );
}

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  children: React.ReactNode;
}

export function LoadingOverlay({
  isVisible,
  message = "Loading...",
  children,
}: LoadingOverlayProps) {
  return (
    <div className="relative">
      {children}
      {isVisible && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg z-10">
          <div className="flex flex-col items-center gap-4 bg-black/80 p-6 rounded-lg">
            <Spinner size="md" />
            <p className="text-sm text-white">{message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
