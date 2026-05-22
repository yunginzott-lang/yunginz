import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function NewsletterCta({ settings }: { settings: any }) {
  return (
    <section className="section-shell">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col items-start justify-between gap-8 p-10 lg:flex-row lg:items-center">
            <div className="space-y-4">
              <div className="section-kicker">Stay locked in</div>
              <h3 className="text-3xl font-semibold uppercase text-[#f4efe7] md:text-4xl">
                {settings?.newsletterTitle ?? "Tap in with every new drop."}
              </h3>
              <p className="max-w-3xl text-base text-foreground/65 md:text-lg">
                {settings?.newsletterDescription ??
                  "Fresh loop kits, drum kits, sound banks, and direct release updates."}
              </p>
            </div>
            <Button asChild size="lg">
              <a href="#contact">Join The List</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
