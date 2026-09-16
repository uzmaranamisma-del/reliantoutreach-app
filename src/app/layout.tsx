import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";
import { Providers } from "@/components/providers";
import { PwaInstall } from "@/components/pwa-install";
export const metadata: Metadata = {
  title: { default: "ReliantOutreach", template: "%s · ReliantOutreach" },
  description: "Your outreach workspace.",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/app-icon-192.png", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "ReliantOutreach", statusBarStyle: "default" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <PwaInstall />
      </body>
    </html>
  );
}
