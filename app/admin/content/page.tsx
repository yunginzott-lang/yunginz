import Link from "next/link";

import { saveHomepageSection, saveSiteSettings } from "@/app/admin/actions";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminContentData } from "@/lib/data/admin";

export const dynamic = "force-dynamic";

function asPrettyJson(value: unknown) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

export default async function AdminContentPage() {
  const session = await requireAdmin();
  const data = await getAdminContentData();

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 lg:px-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="section-kicker">Admin dashboard</div>
          <h1 className="mt-4 text-5xl font-semibold uppercase text-[#f4efe7] md:text-6xl">
            Website content
          </h1>
          <p className="mt-3 text-lg text-foreground/60">
            Signed in as {session.user?.email}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline">
            <Link href="/admin">Back to Beat Management</Link>
          </Button>
          <SignOutButton />
        </div>
      </div>

      <div className="mt-10 grid gap-6">
        <Card className="glass-card border-white/10">
          <CardContent className="p-8">
            <div className="section-kicker">Global settings</div>
            <h2 className="mt-4 text-3xl font-semibold uppercase text-[#f4efe7]">Site Settings</h2>
            <form action={saveSiteSettings} className="mt-6 grid gap-5 lg:grid-cols-2">
              <div>
                <Label>Site Name</Label>
                <Input name="siteName" defaultValue={data.settings?.siteName ?? ""} />
              </div>
              <div>
                <Label>Site URL</Label>
                <Input name="siteUrl" defaultValue={data.settings?.siteUrl ?? ""} />
              </div>
              <div className="lg:col-span-2">
                <Label>Default SEO Title</Label>
                <Input name="defaultSeoTitle" defaultValue={data.settings?.defaultSeoTitle ?? ""} />
              </div>
              <div className="lg:col-span-2">
                <Label>Default SEO Description</Label>
                <Textarea
                  name="defaultSeoDescription"
                  defaultValue={data.settings?.defaultSeoDescription ?? ""}
                  rows={3}
                />
              </div>
              <div>
                <Label>Producer Name</Label>
                <Input name="producerName" defaultValue={data.settings?.producerName ?? ""} />
              </div>
              <div>
                <Label>Producer Tagline</Label>
                <Input name="producerTagline" defaultValue={data.settings?.producerTagline ?? ""} />
              </div>
              <div>
                <Label>Contact Email</Label>
                <Input name="contactEmail" defaultValue={data.settings?.contactEmail ?? ""} />
              </div>
              <div>
                <Label>Instagram URL</Label>
                <Input name="instagramUrl" defaultValue={data.settings?.instagramUrl ?? ""} />
              </div>
              <div>
                <Label>YouTube URL</Label>
                <Input name="youtubeUrl" defaultValue={data.settings?.youtubeUrl ?? ""} />
              </div>
              <div>
                <Label>SoundCloud URL</Label>
                <Input name="soundcloudUrl" defaultValue={data.settings?.soundcloudUrl ?? ""} />
              </div>
              <div>
                <Label>X/Snap URL</Label>
                <Input name="xUrl" defaultValue={data.settings?.xUrl ?? ""} />
              </div>
              <div className="lg:col-span-2">
                <Label>Newsletter Title</Label>
                <Input name="newsletterTitle" defaultValue={data.settings?.newsletterTitle ?? ""} />
              </div>
              <div className="lg:col-span-2">
                <Label>Newsletter Description</Label>
                <Textarea
                  name="newsletterDescription"
                  defaultValue={data.settings?.newsletterDescription ?? ""}
                  rows={3}
                />
              </div>
              <div className="lg:col-span-2">
                <Label>Hero Stats (JSON)</Label>
                <Textarea
                  name="heroStats"
                  defaultValue={asPrettyJson(data.settings?.heroStats ?? [])}
                  rows={6}
                />
              </div>
              <div className="lg:col-span-2">
                <Label>Footer Policies (JSON)</Label>
                <Textarea
                  name="footerPolicies"
                  defaultValue={asPrettyJson(data.settings?.footerPolicies ?? [])}
                  rows={6}
                />
              </div>
              <Button type="submit" className="lg:col-span-2">
                Save Site Settings
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10">
          <CardContent className="p-8">
            <div className="section-kicker">Homepage sections</div>
            <h2 className="mt-4 text-3xl font-semibold uppercase text-[#f4efe7]">
              Edit Section Content
            </h2>
            <div className="mt-6 space-y-4">
              {data.sections.map((section) => (
                <details
                  key={section.id}
                  className="rounded-3xl border border-white/10 bg-black/20"
                  open={false}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5">
                    <div>
                      <div className="text-2xl font-semibold uppercase text-[#f4efe7]">
                        {section.key}
                      </div>
                      <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-foreground/40">
                        {section.title}
                      </div>
                    </div>
                    <div className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
                      Edit
                    </div>
                  </summary>
                  <div className="border-t border-white/10 px-5 py-6">
                    <form action={saveHomepageSection} className="grid gap-5">
                      <Input type="hidden" name="id" value={section.id} />
                      <div>
                        <Label>Title</Label>
                        <Input name="title" defaultValue={section.title} />
                      </div>
                      <div>
                        <Label>Subtitle</Label>
                        <Input name="subtitle" defaultValue={section.subtitle ?? ""} />
                      </div>
                      <div>
                        <Label>Content (JSON)</Label>
                        <Textarea
                          name="content"
                          defaultValue={asPrettyJson(section.content)}
                          rows={12}
                        />
                      </div>
                      <Button type="submit">Save Section</Button>
                    </form>
                  </div>
                </details>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

