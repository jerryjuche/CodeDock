"use client";

import Link from "next/link";
import MarketingShell from "@/components/marketing/marketing-shell";
import TextRotate from "@/components/fancy/text/text-rotate";
import { Server, Users, Settings, Building, Rocket, Code } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const { token, hydrated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && token) {
      router.push("/dashboard");
    }
  }, [hydrated, token, router]);
  return (
    <MarketingShell>
      <main className="grid lg:grid-cols-[1.1fr_0.9fr]">
        <section className="max-w-4xl space-y-8">
          <div className="space-y-4 animate-fade-in-up">
            <h1 className="max-w-3xl text-[40px] leading-[1.1] font-semibold tracking-tight text-white sm:text-[48px] lg:text-[56px] opacity-0 animate-fade-in-up">
              Professional collaborative coding that feels{" "}
              <TextRotate
                texts={[
                  "owned",
                  "stable",
                  "fast",
                  "focused",
                  "enterprise-grade",
                ]}
              />
            </h1>
            <p className="max-w-2xl text-base leading-8 text-[rgb(158,183,211)] opacity-0 animate-fade-in-up delay-150">
              CodeDock gives engineering teams a control plane for shared VS
              Code sessions, room lifecycle, invites, and launch readiness
              without sacrificing ownership.
            </p>
          </div>

          <div className="grid max-w-4xl gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 opacity-0 animate-fade-in-up delay-150 transition hover:bg-white/[0.06]">
              <Server className="h-8 w-8 text-[rgb(36,166,242)] mb-3" />
              <div className="text-sm font-medium text-white">
                Own your stack
              </div>
              <p className="mt-2 text-sm text-[rgb(158,183,211)]">
                Deploy and operate collaboration on your own infrastructure.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 opacity-0 animate-fade-in-up delay-250 transition hover:bg-white/[0.06]">
              <Users className="h-8 w-8 text-[rgb(239,102,46)] mb-3" />
              <div className="text-sm font-medium text-white">
                Room workflow
              </div>
              <p className="mt-2 text-sm text-[rgb(158,183,211)]">
                Create rooms, invite collaborators, and launch directly into VS
                Code.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 opacity-0 animate-fade-in-up delay-350 transition hover:bg-white/[0.06]">
              <Settings className="h-8 w-8 text-[rgb(249,145,53)] mb-3" />
              <div className="text-sm font-medium text-white">
                Control plane first
              </div>
              <p className="mt-2 text-sm text-[rgb(158,183,211)]">
                Manage session readiness, access, and launch from one place.
              </p>
            </div>
          </div>
        </section>

        <section className="lg:justify-self-end">
          <div className="w-full max-w-[440px] rounded-[24px] border border-white/10 bg-[rgba(8,30,63,0.76)] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl opacity-0 animate-fade-in-up delay-450">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[rgb(158,183,211)]">
                Why CodeDock
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Building className="h-6 w-6 text-[rgb(36,166,242)] mt-1 flex-shrink-0" />
                  <div>
                    <div className="text-xl font-semibold text-white">
                      Built for engineering teams
                    </div>
                    <p className="mt-1 text-sm leading-7 text-[rgb(158,183,211)]">
                      High-signal collaboration UI without consumer-app noise.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Rocket className="h-6 w-6 text-[rgb(239,102,46)] mt-1 flex-shrink-0" />
                  <div>
                    <div className="text-xl font-semibold text-white">
                      Launch-aware workflow
                    </div>
                    <p className="mt-1 text-sm leading-7 text-[rgb(158,183,211)]">
                      Readiness, invites, and workspace flow stay visible from
                      the control plane.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Code className="h-6 w-6 text-[rgb(249,145,53)] mt-1 flex-shrink-0" />
                  <div>
                    <div className="text-xl font-semibold text-white">
                      Made for VS Code
                    </div>
                    <p className="mt-1 text-sm leading-7 text-[rgb(158,183,211)]">
                      Rooms are created on the web and launched directly into
                      editor sessions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
