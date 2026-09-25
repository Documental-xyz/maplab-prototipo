import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MapLab Studio — Open-Source Mapbox Studio",
  description:
    "Open-source, self-hostable map studio. Edit layers, styles, and tile sources with MapLibre GL and PMTiles. PWA installable, 100% open technologies.",
  keywords: [
    "MapLibre",
    "PMTiles",
    "Mapbox Studio",
    "open-source GIS",
    "MapLab",
    "cartography",
    "tile editor",
  ],
  authors: [{ name: "MapLab Studio" }],
  manifest: "/manifest.webmanifest",
  applicationName: "MapLab Studio",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MapLab Studio",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  openGraph: {
    title: "MapLab Studio",
    description:
      "Open-source map studio with MapLibre, PMTiles, and shadcn/ui.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MapLab Studio",
    description: "Open-source Mapbox Studio alternative.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        </ThemeProvider>
        <ServiceWorkerRegistrar />
        <Toaster />
      </body>
    </html>
  );
}
