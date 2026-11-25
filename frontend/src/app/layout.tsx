import type { Metadata, Viewport } from "next";
import { CONFIG } from "@/lib/config";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: `${CONFIG.cityName} Transit Assistant`,
  description:
    "Local Public Transportation Information, 3D Live Tracking, Demand Forecasting & Fleet Optimization",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#071126",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface text-on-surface min-h-screen antialiased selection:bg-primary-container selection:text-on-primary-container">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
