import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { PwaServiceWorker } from "@/components/common/pwa-service-worker";
import "./globals.css";

export const metadata: Metadata = {
  title: "IronLog | トレーニング記録",
  description: "日々のトレーニングを記録する個人用ログ",
  applicationName: "IronLog",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "IronLog",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#234b37",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        {children}
        <PwaServiceWorker />
      </body>
    </html>
  );
}
