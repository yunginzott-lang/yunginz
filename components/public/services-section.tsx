import { Card, CardContent } from "@/components/ui/card";

export function ServicesSection({
  section
}: {
  section: { title: string; subtitle?: string | null; content: any } | undefined;
}) {
  const content = (section?.content ?? []) as Array<any>;

  return (
    <section id="services" className="section-shell">
      <div className="mx-auto max-w-7xl px-6 py-20 md:py-22 lg:px-10 lg:py-24">
        <div className="space-y-5">
          <div className="section-kicker">{section?.subtitle ?? "Work together"}</div>
          <h2 className="text-4xl font-semibold uppercase leading-[0.95] text-[#f4efe7] md:text-5xl lg:text-6xl">
            {section?.title ?? "What I offer"}
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {content.map((item) => (
            <Card key={item.number}>
              <CardContent className="flex min-h-[290px] flex-col justify-between p-6 md:p-7 lg:min-h-[320px] lg:p-8">
                <div className="space-y-5">
                  <div className="text-5xl font-semibold text-primary/20 lg:text-6xl">{item.number}</div>
                  <div className="text-2xl font-semibold uppercase text-[#f4efe7] lg:text-3xl">
                    {item.title}
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/60 md:text-base lg:text-lg">
                    {item.description}
                  </p>
                </div>
                <div className="space-y-5">
                  <div className="font-mono text-xs uppercase tracking-[0.35em] text-primary">
                    {item.number === "03" && item.priceHint ? `${item.priceHint}/hr` : item.priceHint}
                  </div>
                  <a
                    href="#contact"
                    className="font-mono text-xs uppercase tracking-[0.35em] text-primary"
                  >
                    {item.ctaLabel} {"->"}
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
