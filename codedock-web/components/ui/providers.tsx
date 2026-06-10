"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { TelemetryProvider } from "./telemetry-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30000, // 30 seconds
            refetchOnWindowFocus: false, // Don't refetch on window focus for better performance
            refetchOnReconnect: true,
            networkMode: "offlineFirst", // Handle offline gracefully
          },
          mutations: {
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TelemetryProvider>
        {children}
      </TelemetryProvider>
      <Toaster position="top-right" theme="dark" richColors duration={3000} />
    </QueryClientProvider>
  );
}
