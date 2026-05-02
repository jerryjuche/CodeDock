import "./globals.css";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import Providers from "@/components/ui/providers";

export const metadata: Metadata = {
  title: "CodeDock",
  description: "CodeDock control plane"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
         <Analytics />
      </body>
    </html>
  );
}
