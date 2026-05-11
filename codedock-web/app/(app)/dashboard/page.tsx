// app/(app)/dashboard/page.tsx
import RoomList from "@/components/dashboard/room-list";
import JoinCodeForm from "@/components/dashboard/join-code-form";
import DashboardHeader from "@/components/dashboard/dashboard-header";

export default function DashboardPage() {
  return (
    <div className="flex min-h-full flex-col">
      {/* Header strip */}
      <DashboardHeader />

      {/* Content */}
      <div className="flex-1 px-6 py-6 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* Room list — primary */}
          <RoomList />

          {/* Sidebar: join by code + quick info */}
          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <JoinCodeForm />
            <QuickFeatures />
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickFeatures() {
  const features = [
    {
      label: "VS Code Launch",
      desc: "Open any room directly in your local editor",
      icon: (
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-[rgb(36,166,242)]" aria-hidden="true">
          <path d="M15 3L5 10.5L15 18M5 3l10 7.5L5 18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      accent: "rgba(36,166,242,0.10)",
      border: "rgba(36,166,242,0.15)",
    },
    {
      label: "GitHub Rooms",
      desc: "Link repos from GitHub for instant environment setup",
      icon: (
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-[rgb(249,145,53)]" aria-hidden="true">
          <path fillRule="evenodd" clipRule="evenodd" d="M10 2a8 8 0 00-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.88-1.17-.88-1.17-.72-.49.06-.48.06-.48.8.06 1.22.82 1.22.82.71 1.22 1.87.87 2.32.66.07-.52.28-.87.51-1.07-1.78-.2-3.65-.89-3.65-3.97 0-.88.31-1.6.82-2.16-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0110 6.84c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.16 0 3.09-1.88 3.77-3.67 3.97.29.25.54.73.54 1.48v2.19c0 .21.15.46.55.38A8 8 0 0010 2z" fill="currentColor" />
        </svg>
      ),
      accent: "rgba(249,145,53,0.10)",
      border: "rgba(249,145,53,0.15)",
    },
    {
      label: "Live Presence",
      desc: "See who is online in each room in real time",
      icon: (
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-[rgb(42,211,139)]" aria-hidden="true">
          <circle cx="10" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" />
          <path d="M5 17a5 5 0 0110 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      ),
      accent: "rgba(42,211,139,0.08)",
      border: "rgba(42,211,139,0.14)",
    },
  ];

  return (
    <div className="rounded-[18px] border border-white/[0.07] bg-[rgba(8,30,63,0.60)] p-4 backdrop-blur-xl">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgb(100,140,185)]">
        Platform Features
      </p>
      <div className="space-y-2">
        {features.map((f) => (
          <div
            key={f.label}
            className="flex items-start gap-3 rounded-xl border px-3 py-2.5"
            style={{ background: f.accent, borderColor: f.border }}
          >
            <div className="mt-0.5 shrink-0">{f.icon}</div>
            <div>
              <p className="text-[13px] font-semibold text-white">{f.label}</p>
              <p className="text-[11px] leading-relaxed text-[rgb(100,140,185)]">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
