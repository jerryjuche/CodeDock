import "./globals.css";
import type { Metadata } from "next";
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
      </body>
    </html>
  );
}
