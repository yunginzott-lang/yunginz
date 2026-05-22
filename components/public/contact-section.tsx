"use client";

import Image from "next/image";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TurnstileField } from "@/components/ui/turnstile-field";

export function ContactSection({
  section,
  settings
}: {
  section: { title: string; content: any } | undefined;
  settings: any;
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    email: "",
    inquiryType: "Custom Beat",
    subject: "",
    message: "",
    turnstileToken: ""
  });
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const contactEmail =
    settings?.contactEmail?.replace("yunginzsession@gmail.com", "yunginzsessions@gmail.com") ||
    "yunginzsessions@gmail.com";

  const socialLinks = [
    settings?.instagramUrl ? { label: "IG: @yunginz.prod", href: settings.instagramUrl } : null,
    settings?.xUrl ? { label: "Snapchat: yung1nz", href: settings.xUrl } : null,
    { label: contactEmail, href: `mailto:${contactEmail}` }
  ].filter(Boolean) as Array<{ label: string; href: string }>;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        toast.error(payload.error ?? "We couldn't send your inquiry.");
        return;
      }

      toast.success("Inquiry sent. We'll tap in shortly.");
      setForm({
        name: "",
        email: "",
        inquiryType: "Custom Beat",
        subject: "",
        message: "",
        turnstileToken: ""
      });
    });
  }

  return (
    <section id="contact" className="section-shell">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 md:grid-cols-[0.95fr_1.05fr] md:gap-8 md:py-24 lg:gap-12 lg:px-10">
        <div className="space-y-8">
          <h2 className="text-4xl font-semibold uppercase leading-[0.92] text-[#f4efe7] md:text-5xl lg:text-6xl">
            {section?.title ?? "Let's build"}
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-foreground/60 md:text-[1.02rem] lg:text-lg">
            {section?.content?.description}
          </p>
          <div className="glass-card overflow-hidden border border-white/8">
            <Image
              src="/media/yunginz.webp"
              alt="Yunginz portrait"
              width={960}
              height={1280}
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="h-[240px] w-full object-cover object-center md:h-[320px]"
            />
          </div>
          <div className="space-y-4">
            {socialLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="flex items-center gap-4 font-mono text-xs uppercase tracking-[0.28em] text-foreground/60 hover:text-primary"
              >
                <span className="h-px w-10 bg-white/20" />
                {item.label}
              </a>
            ))}
          </div>
          <div className="space-y-4 text-sm leading-relaxed text-foreground/62 md:text-[0.95rem] lg:text-base">
            <p>
              Charting producer Yunginz has worked with artists including Asian
              Doll, Noodah05, Blo, FBL Manny, Devin Di Dakta, Lora, and Bayka, with a growing
              catalog of placements and collaborations across multiple genres.
            </p>
            <p>
              With a foundation built in real sessions and a sound that continues to evolve,
              Yunginz is focused on delivering records that resonate and stand the test of time.
            </p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-5 md:self-start">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((state) => ({ ...state, email: event.target.value }))}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="type">Inquiry Type</Label>
            <Select
              id="type"
              value={form.inquiryType}
              onChange={(event) =>
                setForm((state) => ({ ...state, inquiryType: event.target.value }))
              }
            >
              <option>Custom Beat</option>
              <option>Mix and Master</option>
              <option>Recording (Session)</option>
              <option>Booking</option>
              <option>Other</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={form.subject}
              onChange={(event) => setForm((state) => ({ ...state, subject: event.target.value }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="message">Project Details</Label>
            <Textarea
              id="message"
              value={form.message}
              onChange={(event) => setForm((state) => ({ ...state, message: event.target.value }))}
              placeholder="Tell me about your project..."
              required
            />
          </div>
          <TurnstileField
            siteKey={turnstileSiteKey}
            value={form.turnstileToken}
            onChange={(token) =>
              setForm((state) => ({ ...state, turnstileToken: token }))
            }
          />
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Sending..." : "Send Inquiry"}
          </Button>
        </form>
      </div>
    </section>
  );
}
