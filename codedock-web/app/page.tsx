import MarketingShell from "@/components/marketing/marketing-shell";
import HeroSection from "@/components/marketing/hero-section";
import FeaturesSection from "@/components/marketing/features-section";
import CtaSection from "@/components/marketing/cta-section";

export const metadata = {
  title: "CodeDock — Self-hosted collaborative coding for engineering teams",
  description:
    "CodeDock gives engineering teams a control plane for shared VS Code sessions, room lifecycle, invites, and launch readiness without sacrificing ownership.",
};

export default function HomePage() {
  return (
    <MarketingShell>
      <HeroSection />
      <FeaturesSection />
      <CtaSection />
    </MarketingShell>
  );
}
