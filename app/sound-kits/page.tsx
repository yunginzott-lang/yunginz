import type { Metadata } from "next";

import { Footer } from "@/components/public/footer";
import { SiteHeader } from "@/components/public/site-header";
import { SoundKitsSection } from "@/components/public/sound-kits-section";
import { getPublicSiteData } from "@/lib/data/public";
import { getBaseUrl } from "@/lib/utils";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getBaseUrl();

  return {
    title: "Sound Kits | YUNG1NZ",
    description:
      "Browse Yunginz loop kits, sample packs, drum kits, and sound banks for modern producers.",
    alternates: {
      canonical: `${baseUrl}/sound-kits`
    },
    openGraph: {
      title: "Sound Kits | YUNG1NZ",
      description:
        "Browse Yunginz loop kits, sample packs, drum kits, and sound banks for modern producers.",
      url: `${baseUrl}/sound-kits`,
      siteName: "YUNG1NZ",
      type: "website"
    }
  };
}

export default async function SoundKitsPage() {
  const data = await getPublicSiteData();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="pt-20">
        <SoundKitsSection soundKits={data.soundKits} showAllLink={false} />
      </div>
      <Footer settings={data.settings} />
    </main>
  );
}
