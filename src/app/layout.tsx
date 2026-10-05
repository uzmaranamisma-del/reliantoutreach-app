import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./workspace.css";
import "../../public/ui-kit/css/tokens.css";
import "../../public/ui-kit/css/components.css";
import "./ui-kit.css";
import "./auth.css";
import "./ai-workspace.css";
import { Providers } from "@/components/providers";
import { PwaRegistration } from "@/components/pwa-registration";
export const metadata: Metadata = {
  title: { default: "ReliantOutreach", template: "%s · ReliantOutreach" },
  description: "Your outreach workspace.",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg?v=20261005", type: "image/svg+xml" },
      { url: "/favicon-32x32.png?v=20261005", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png?v=20261005", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.ico?v=20261005",
    apple: { url: "/apple-touch-icon.png?v=20261005", sizes: "180x180", type: "image/png" },
  },
  appleWebApp: {
    capable: true,
    title: "ReliantOutreach",
    statusBarStyle: "default",
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#123477",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" data-theme-pref="dark" suppressHydrationWarning>
      <head>
        {/* Blocking bootstrap applies the saved theme before the first paint. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/ui-kit/js/theme.js" />
      </head>
      <body className="ro">
        <Providers>{children}</Providers>
        <PwaRegistration />
      </body>
    </html>
  );
}
