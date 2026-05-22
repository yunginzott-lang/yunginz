import Link from "next/link";

import { deleteSoundKit, saveSoundKit } from "@/app/admin/actions";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { SoundKitFields } from "@/components/admin/sound-kit-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminSoundKitData } from "@/lib/data/admin";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminSoundKitsPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const session = await requireAdmin();
  const params = (await searchParams) ?? {};
  const query = params.q?.trim().toLowerCase() ?? "";
  const data = await getAdminSoundKitData();

  const kits = query
    ? data.soundKits.filter((kit) =>
        [kit.title, kit.slug, kit.category, kit.tags, kit.description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)
      )
    : data.soundKits;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 lg:px-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="section-kicker">Admin dashboard</div>
          <h1 className="mt-4 text-5xl font-semibold uppercase text-[#f4efe7] md:text-6xl">
            Sound kit management
          </h1>
          <p className="mt-3 text-lg text-foreground/60">
            Signed in as {session.user?.email}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline">
            <Link href="/admin">Back to beat management</Link>
          </Button>
          <SignOutButton />
        </div>
      </div>

      <div className="mt-10 grid gap-6">
        <Card className="glass-card border-white/10">
          <CardContent className="p-8">
            <details className="group" open={false}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <div>
                  <div className="section-kicker">Upload sound kit</div>
                  <h2 className="mt-4 text-3xl font-semibold uppercase text-[#f4efe7]">
                    Add a new kit
                  </h2>
                </div>
                <div className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
                  Expand
                </div>
              </summary>

              <form action={saveSoundKit} className="mt-8 grid gap-5 lg:grid-cols-2">
                <Input type="hidden" name="id" />
                <SoundKitFields />
                <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Status</Label>
                    <Select name="status" defaultValue="PUBLISHED">
                      <option value="DRAFT">Draft</option>
                      <option value="PUBLISHED">Published</option>
                      <option value="ARCHIVED">Archived</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Featured</Label>
                    <Select name="isFeatured" defaultValue="false">
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="lg:col-span-2">
                  Save sound kit
                </Button>
              </form>
            </details>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10">
          <CardContent className="p-8">
            <div className="section-kicker">Existing kits</div>
            <h2 className="mt-4 text-3xl font-semibold uppercase text-[#f4efe7]">
              Click edit to update each kit
            </h2>

            <form className="mt-6 flex flex-col gap-4 md:flex-row md:items-end">
              <div className="flex-1">
                <Label>Search kits</Label>
                <Input name="q" defaultValue={params.q ?? ""} placeholder="Search title, slug, category, terms" />
              </div>
              <Button type="submit" variant="outline">
                Search
              </Button>
            </form>

            <div className="mt-8 space-y-4">
              {kits.map((kit) => (
                <details
                  key={kit.id}
                  className="rounded-3xl border border-white/10 bg-black/20"
                  open={false}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5">
                    <div>
                      <div className="text-2xl font-semibold uppercase text-[#f4efe7]">
                        {kit.title}
                      </div>
                      <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-foreground/40">
                        {kit.category || "Sound kit"} - {formatCurrency(kit.priceCents)} - {kit.status}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
                        Edit
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-foreground/35">
                        {kit.isFeatured ? "Featured" : "Standard"}
                      </div>
                    </div>
                  </summary>

                  <div className="border-t border-white/10 px-5 py-6">
                    <form action={saveSoundKit} className="grid gap-5 lg:grid-cols-2">
                      <Input type="hidden" name="id" value={kit.id} />
                      <SoundKitFields
                        initialTitle={kit.title}
                        initialSlug={kit.slug}
                        initialDescription={kit.description ?? ""}
                        initialPriceCents={kit.priceCents}
                        initialCoverImageUrl={kit.coverImageUrl ?? ""}
                        initialPreviewMp3Url={kit.previewMp3Url ?? ""}
                        initialDownloadUrl={kit.downloadUrl}
                        initialCategory={kit.category ?? ""}
                        initialTags={kit.tags ?? ""}
                      />
                      <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label>Status</Label>
                          <Select name="status" defaultValue={kit.status}>
                            <option value="DRAFT">Draft</option>
                            <option value="PUBLISHED">Published</option>
                            <option value="ARCHIVED">Archived</option>
                          </Select>
                        </div>
                        <div>
                          <Label>Featured</Label>
                          <Select name="isFeatured" defaultValue={kit.isFeatured ? "true" : "false"}>
                            <option value="false">No</option>
                            <option value="true">Yes</option>
                          </Select>
                        </div>
                      </div>
                      <div className="lg:col-span-2 flex flex-wrap gap-3">
                        <Button type="submit">Save sound kit</Button>
                      </div>
                    </form>

                    <form action={deleteSoundKit} className="mt-5">
                      <input type="hidden" name="id" value={kit.id} />
                      <Button type="submit" variant="outline" className="border-red-500/35 text-red-200">
                        Delete sound kit
                      </Button>
                    </form>
                  </div>
                </details>
              ))}

              {!kits.length ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-foreground/45">
                  No sound kits yet. Add your first pack above.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
