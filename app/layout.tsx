import type { Metadata } from "next";
import { Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";

import "@/app/globals.css";
import { StickyBeatPlayer } from "@/components/public/sticky-beat-player";
import { AppToaster } from "@/components/ui/toast";
import { getBaseUrl } from "@/lib/utils";

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-barlow-condensed"
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono"
});

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: {
    default: "YUNG1NZ | Beats, Recording, Mixing & Production",
    template: "%s | YUNG1NZ"
  },
  description:
    "Premium producer website for beats, licensing, recording, and mixing. Browse beats, choose licenses, and work directly with YUNG1NZ.",
  keywords: [
    "YUNG1NZ",
    "Yunginz",
    "beat store",
    "buy beats online",
    "trap beats",
    "afrobeats beats",
    "r&b beats",
    "dancehall beats",
    "amapiano beats",
    "neo soul beats",
    "mixing and mastering",
    "recording session"
  ],
  alternates: {
    canonical: "/"
  },
  robots: {
    index: true,
    follow: true
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "YUNG1NZ | Beats, Recording, Mixing & Production",
    description:
      "Browse premium beats, secure licenses, and work directly with YUNG1NZ.",
    url: getBaseUrl(),
    siteName: "YUNG1NZ",
    images: [
      {
        url: "/media/yunginz-yellow-hero.jpg",
        width: 1200,
        height: 630,
        alt: "YUNG1NZ Producer Brand"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "YUNG1NZ | Beats, Recording, Mixing & Production",
    description:
      "Browse premium beats, secure licenses, and work directly with YUNG1NZ.",
    images: ["/media/yunginz-yellow-hero.jpg"]
  },
  icons: {
    icon: "/media/logo.png",
    shortcut: "/media/logo.png",
    apple: "/media/logo.png"
  },
  category: "music"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${barlowCondensed.variable} ${plexMono.variable} grain`}>
        {children}
        <StickyBeatPlayer />
        <AppToaster />
      </body>
    </html>
  );
}
