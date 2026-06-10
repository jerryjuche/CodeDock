"use client";

import { useEffect, Suspense } from "react";
import posthog from "posthog-js";
import { useAuth } from "@/hooks/use-auth";
import { usePathname, useSearchParams } from "next/navigation";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || "";
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

function TelemetryTracker() {
  const { userId, email, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Sync authentication status
  useEffect(() => {
    if (!POSTHOG_KEY) return;
    if (typeof window !== "undefined") {
      if (isAuthenticated && userId) {
        posthog.identify(userId, {
          email: email || undefined,
        });
      } else {
        posthog.reset();
      }
    }
  }, [userId, email, isAuthenticated]);

  // Track pageviews when path/query changes
  useEffect(() => {
    if (!POSTHOG_KEY) return;
    if (typeof window !== "undefined" && pathname) {
      let url = window.origin + pathname;
      if (searchParams && searchParams.toString()) {
        url += `?${searchParams.toString()}`;
      }
      posthog.capture("$pageview", {
        $current_url: url,
      });
    }
  }, [pathname, searchParams]);

  return null;
}

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  // Initialize PostHog
  useEffect(() => {
    if (!POSTHOG_KEY) {
      console.log("Telemetry disabled: NEXT_PUBLIC_POSTHOG_KEY is not set.");
      return;
    }
    if (typeof window !== "undefined") {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        person_profiles: "identified_only",
        capture_pageview: false, // Track manually for accurate single-page app views
      });
    }
  }, []);

  return (
    <>
      {POSTHOG_KEY ? (
        <Suspense fallback={null}>
          <TelemetryTracker />
        </Suspense>
      ) : null}
      {children}
    </>
  );
}
