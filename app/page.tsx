import { Suspense } from "react";

import { AboutSection } from "@/components/public/about-section";
import { CatalogExperience } from "@/components/public/catalog-experience";
import { ContactSection } from "@/components/public/contact-section";
import { Footer } from "@/components/public/footer";
import { HeroSection } from "@/components/public/hero-section";
import { NewsletterCta } from "@/components/public/newsletter-cta";
import { PricingSection } from "@/components/public/pricing-section";
import { SoundKitsSection } from "@/components/public/sound-kits-section";
import { ServicesSection } from "@/components/public/services-section";
import { SiteHeader } from "@/components/public/site-header";
import { getPublicSiteData } from "@/lib/data/public";
import { getBaseUrl } from "@/lib/utils";

export const revalidate = 300;

export default async function HomePage() {
  const data = await getPublicSiteData();
  const baseUrl = getBaseUrl();
  const siteName = data.settings?.siteName || "YUNG1NZ";
  const producerName = data.settings?.producerName || "Yunginz";
  const contactEmail = data.settings?.contactEmail || "yunginzbeats@gmail.com";
  const sameAs = [
    data.settings?.instagramUrl,
    data.settings?.youtubeUrl,
    data.settings?.soundcloudUrl,
    data.settings?.xUrl
  ].filter(Boolean);

  const hero = data.sections.find((section) => section.key === "hero");
  const about = data.sections.find((section) => section.key === "about");
  const services = data.sections.find((section) => section.key === "services");
  const contact = data.sections.find((section) => section.key === "contact");
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${baseUrl}#website`,
        name: siteName,
        url: baseUrl,
        inLanguage: "en",
        potentialAction: {
          "@type": "SearchAction",
          target: `${baseUrl}/#beats`,
          "query-input": "required name=search_term_string"
        }
      },
      {
        "@type": "MusicGroup",
        "@id": `${baseUrl}#artist`,
        name: producerName,
        alternateName: "YUNG1NZ",
        url: baseUrl,
        genre: ["Trap", "Afrobeats", "R&B", "Dancehall", "Amapiano", "Neo Soul"],
        email: contactEmail,
        sameAs
      },
      {
        "@type": "Organization",
        "@id": `${baseUrl}#organization`,
        name: siteName,
        url: baseUrl,
        logo: `${baseUrl}/media/logo.png`,
        email: contactEmail,
        sameAs
      },
      {
        "@type": "FAQPage",
        "@id": `${baseUrl}#faq`,
        mainEntity: [
          {
            "@type": "Question",
            name: "Can I preview beats before buying?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes. You can stream beat previews directly on the website before selecting a license."
            }
          },
          {
            "@type": "Question",
            name: "How are purchased files delivered?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "After successful payment, delivery links are provided based on the selected license terms."
            }
          },
          {
            "@type": "Question",
            name: "Do you offer custom production services?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes. You can submit inquiries for custom beats, recording sessions, and mix/master services through the contact section."
            }
          },
          {
            "@type": "Question",
            name: "Do you sell sound kits and sample packs?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes. Sound kits and sample packs are listed in the kits section and delivered after secure PayPal checkout."
            }
          }
        ]
      }
    ]
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <SiteHeader />
      <HeroSection section={hero} settings={data.settings} />
      <AboutSection section={about} />
      <Suspense fallback={<div className="px-6 py-24 text-center text-foreground/60">Loading beats...</div>}>
        <CatalogExperience beats={data.beats} licenses={data.licenses} />
      </Suspense>
      <SoundKitsSection soundKits={data.soundKits} />
      <PricingSection licenses={data.licenses} />
      <ServicesSection section={services} />
      <NewsletterCta settings={data.settings} />
      <ContactSection section={contact} settings={data.settings} />
      <Footer settings={data.settings} />
    </main>
  );
}
