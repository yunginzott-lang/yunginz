import Link from "next/link";
import { saveBeat, saveBeatLicenseOverride } from "@/app/admin/actions";
import { AssetUploader } from "@/components/admin/asset-uploader";
import { BeatIdentityFields } from "@/components/admin/beat-identity-fields";
import { DeleteBeatForm } from "@/components/admin/delete-beat-form";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminDashboardData } from "@/lib/data/admin";
import { createUploadAuth } from "@/lib/upload-auth";
import { TAG_SUGGESTIONS } from "@/lib/tag-suggestions";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; page?: string }>;
}) {
  const session = await requireAdmin();
  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const data = await getAdminDashboardData({ query, page });
  const coverUploadAuth = createUploadAuth(session.user!.id, "covers");

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 lg:px-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="section-kicker">Admin dashboard</div>
          <h1 className="mt-4 text-5xl font-semibold uppercase text-[#f4efe7] md:text-6xl">
            Beat management
          </h1>
          <p className="mt-3 text-lg text-foreground/60">
            Signed in as {session.user?.email}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline">
            <Link href="/admin/content">Customize Website Content</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/kits">Manage Sound Kits</Link>
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
                  <div className="section-kicker">Upload beat</div>
                  <h2 className="mt-4 text-3xl font-semibold uppercase text-[#f4efe7]">
                    Add a new beat
                  </h2>
                </div>
                <div className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
                  Expand
                </div>
              </summary>
              <form action={saveBeat} className="mt-8 grid gap-5 lg:grid-cols-2">
                <Input type="hidden" name="id" />
                <BeatIdentityFields />
                <div className="lg:col-span-2">
                  <AssetUploader
                    folder="covers"
                    name="coverImageUrl"
                    label="Cover Art"
                    accept="image/*"
                    uploadAuth={coverUploadAuth}
                  />
                  <p className="mt-2 text-xs text-foreground/45">
                    Re-uploading the same image reuses the same stored file instead of creating a duplicate.
                  </p>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select name="status" defaultValue="PUBLISHED">
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="SOLD">Sold</option>
                  </Select>
                </div>
                <div className="lg:col-span-2">
                  <Label>Tags (comma separated)</Label>
                  <Input name="tags" list="tag-suggestions" />
                  <p className="mt-2 text-xs text-foreground/45">
                    Suggested tags loaded from your website tag list. You can still type custom ones.
                  </p>
                </div>
                <div className="lg:col-span-2 space-y-4 rounded-2xl border border-white/10 p-5">
                  <div className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
                    License delivery links
                  </div>
                  {data.licenses.map((license) => (
                    <details key={license.id} className="rounded-2xl border border-white/10 p-4">
                      <summary className="cursor-pointer list-none text-base font-semibold uppercase text-[#f4efe7]">
                        {license.name}
                      </summary>
                      <div className="mt-4 space-y-4">{renderLicenseLinkFields(license.code)}</div>
                    </details>
                  ))}
                </div>
                <Button type="submit" className="lg:col-span-2">
                  Save beat
                </Button>
              </form>
            </details>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10">
          <CardContent className="p-8">
            <div className="section-kicker">Existing beats</div>
            <h2 className="mt-4 text-3xl font-semibold uppercase text-[#f4efe7]">
              Click edit to update each beat
            </h2>

            <form className="mt-6 flex flex-col gap-4 md:flex-row md:items-end">
              <div className="flex-1">
                <Label>Search beats</Label>
                <Input name="q" defaultValue={query} placeholder="Search title, slug, genre, mood" />
              </div>
              <Button type="submit" variant="outline">
                Search
              </Button>
            </form>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs uppercase tracking-[0.22em] text-foreground/45">
              <div>
                Showing {(data.currentPage - 1) * data.pageSize + (data.beats.length ? 1 : 0)}-
                {(data.currentPage - 1) * data.pageSize + data.beats.length} of {data.totalBeats}
              </div>
              <div>15 beats per page</div>
            </div>

            <div className="mt-8 space-y-4">
              {data.beats.map((beat) => (
                <details
                  key={beat.id}
                  className="rounded-3xl border border-white/10 bg-black/20"
                  open={false}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5">
                    <div>
                      <div className="text-2xl font-semibold uppercase text-[#f4efe7]">
                        {beat.title}
                      </div>
                      <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-foreground/40">
                        {beat.genre} - {beat.mood} - {beat.bpm} BPM - {beat.status}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
                        Edit
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-foreground/35">
                        {beat._count.orderItems
                          ? `${beat._count.orderItems} orders`
                          : "No orders"}
                      </div>
                    </div>
                  </summary>

                  <div className="border-t border-white/10 px-5 py-6">
                    <form action={saveBeat} className="grid gap-5 lg:grid-cols-2">
                      <Input type="hidden" name="id" value={beat.id} />
                      <BeatIdentityFields
                        initialTitle={beat.title}
                        initialSlug={beat.slug}
                        initialGenres={beat.genre}
                        initialPreviewUrl={beat.previewMp3Url}
                        initialBpm={beat.bpm}
                        initialDurationSeconds={beat.durationSeconds ?? ""}
                        initialMood={beat.mood}
                        initialDescription={beat.description ?? ""}
                      />
                      <div className="lg:col-span-2">
                        <AssetUploader
                          folder="covers"
                          name="coverImageUrl"
                          label="Cover Art"
                          accept="image/*"
                          defaultValue={beat.coverImageUrl ?? ""}
                          uploadAuth={coverUploadAuth}
                        />
                        <p className="mt-2 text-xs text-foreground/45">
                          Matching image uploads reuse the same stored cover file automatically.
                        </p>
                      </div>
                      <div>
                        <Label>Status</Label>
                        <Select name="status" defaultValue={beat.status}>
                          <option value="DRAFT">Draft</option>
                          <option value="PUBLISHED">Published</option>
                          <option value="SOLD">Sold</option>
                        </Select>
                      </div>
                      <div className="lg:col-span-2">
                        <Label>Tags (comma separated)</Label>
                        <Input
                          name="tags"
                          list="tag-suggestions"
                          defaultValue={beat.tags.map((tag) => tag.value).join(", ")}
                        />
                        <p className="mt-2 text-xs text-foreground/45">
                          Use the shared site tag list or add custom tags as needed.
                        </p>
                      </div>
                      <div className="lg:col-span-2 flex flex-wrap gap-3">
                        <Button type="submit">Save beat</Button>
                      </div>
                    </form>

                    {beat.licenses.length > 0 ? (
                      <div className="mt-8 grid gap-4 lg:grid-cols-2">
                        {beat.licenses.map((license) => (
                          <details
                            key={license.id}
                            className="rounded-2xl border border-white/10 p-4"
                          >
                            <summary className="cursor-pointer list-none text-lg font-semibold uppercase text-primary">
                              {license.customName ?? license.licenseTemplate.name}
                            </summary>
                            <form action={saveBeatLicenseOverride} className="mt-4 space-y-4">
                              <input type="hidden" name="beatId" value={beat.id} />
                              <input
                                type="hidden"
                                name="licenseTemplateId"
                                value={license.licenseTemplateId}
                              />
                              {license.licenseTemplate.code === "basic" && (
                                <>
                                  <div>
                                    <Label>MP3 Link</Label>
                                    <Input
                                      name="mp3Link"
                                      defaultValue={license.deliveryLinks.find((l) => l.label.includes("MP3"))?.url ?? ""}
                                      placeholder="https://dropbox.com/..."
                                    />
                                  </div>
                                  <div>
                                    <Label>Producers Tag Link</Label>
                                    <Input
                                      name="producersTagLink"
                                      defaultValue={license.deliveryLinks.find((l) => l.label.includes("Tag"))?.url ?? ""}
                                      placeholder="https://dropbox.com/..."
                                    />
                                  </div>
                                </>
                              )}
                              {license.licenseTemplate.code === "standard" && (
                                <>
                                  <div>
                                    <Label>MP3 Link</Label>
                                    <Input
                                      name="mp3Link"
                                      defaultValue={license.deliveryLinks.find((l) => l.label.includes("MP3"))?.url ?? ""}
                                      placeholder="https://dropbox.com/..."
                                    />
                                  </div>
                                  <div>
                                    <Label>WAV Link</Label>
                                    <Input
                                      name="wavLink"
                                      defaultValue={license.deliveryLinks.find((l) => l.label.includes("WAV"))?.url ?? ""}
                                      placeholder="https://dropbox.com/..."
                                    />
                                  </div>
                                  <div>
                                    <Label>Producers Tag Link</Label>
                                    <Input
                                      name="producersTagLink"
                                      defaultValue={license.deliveryLinks.find((l) => l.label.includes("Tag"))?.url ?? ""}
                                      placeholder="https://dropbox.com/..."
                                    />
                                  </div>
                                </>
                              )}
                              {(license.licenseTemplate.code === "unlimited" ||
                                license.licenseTemplate.code === "exclusive") && (
                                <>
                                  <div>
                                    <Label>MP3 Link</Label>
                                    <Input
                                      name="mp3Link"
                                      defaultValue={license.deliveryLinks.find((l) => l.label.includes("MP3"))?.url ?? ""}
                                      placeholder="https://dropbox.com/..."
                                    />
                                  </div>
                                  <div>
                                    <Label>WAV Link</Label>
                                    <Input
                                      name="wavLink"
                                      defaultValue={license.deliveryLinks.find((l) => l.label.includes("WAV"))?.url ?? ""}
                                      placeholder="https://dropbox.com/..."
                                    />
                                  </div>
                                  <div>
                                    <Label>Stems Link</Label>
                                    <Input
                                      name="stemsLink"
                                      defaultValue={license.deliveryLinks.find((l) => l.label.includes("Stems"))?.url ?? ""}
                                      placeholder="https://dropbox.com/..."
                                    />
                                  </div>
                                  <div>
                                    <Label>Producers Tag Link</Label>
                                    <Input
                                      name="producersTagLink"
                                      defaultValue={license.deliveryLinks.find((l) => l.label.includes("Tag"))?.url ?? ""}
                                      placeholder="https://dropbox.com/..."
                                    />
                                  </div>
                                </>
                              )}
                              <Button type="submit" variant="outline">
                                Save license
                              </Button>
                            </form>
                          </details>
                        ))}
                      </div>
                    ) : null}

                    <DeleteBeatForm
                      beatId={beat.id}
                      beatTitle={beat.title}
                      hasOrders={beat._count.orderItems > 0}
                    />
                  </div>
                </details>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {Array.from({ length: data.totalPages }, (_, index) => {
                const nextPage = index + 1;
                const href = query
                  ? `/admin?q=${encodeURIComponent(query)}&page=${nextPage}`
                  : `/admin?page=${nextPage}`;
                const isActive = nextPage === data.currentPage;

                return (
                  <a
                    key={nextPage}
                    href={href}
                    className={`flex h-10 min-w-10 items-center justify-center px-3 font-mono text-xs uppercase tracking-[0.2em] ${
                      isActive
                        ? "bg-primary text-black"
                        : "border border-white/10 text-foreground/65 hover:border-primary hover:text-primary"
                    }`}
                  >
                    {nextPage}
                  </a>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10">
          <CardContent className="p-8">
            <div className="section-kicker">Recent activity</div>
            <h2 className="mt-4 text-3xl font-semibold uppercase text-[#f4efe7]">
              Admin activity log
            </h2>
            <div className="mt-6 space-y-3">
              {data.activityLogs.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-white/10 px-4 py-4 text-sm text-foreground/72"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-primary">
                        {entry.action.replaceAll("_", " ")}
                      </div>
                      <div className="mt-1 text-base font-medium text-[#f4efe7]">
                        {entry.targetLabel || entry.targetType}
                      </div>
                      <div className="mt-1 text-xs text-foreground/45">
                        {entry.adminUser.name || entry.adminUser.email}
                      </div>
                    </div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground/45">
                      {new Date(entry.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
              {!data.activityLogs.length ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-foreground/45">
                  No admin activity yet.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
      <datalist id="tag-suggestions">
        {TAG_SUGGESTIONS.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
    </main>
  );
}

function renderLicenseLinkFields(code: string) {
  const producerTagField = (
    <div>
      <Label>Producers Tag Link</Label>
      <Input name={`license_${code}_producersTagLink`} placeholder="https://dropbox.com/..." />
    </div>
  );

  if (code === "basic") {
    return (
      <>
        <div>
          <Label>MP3 Link</Label>
          <Input name="license_basic_mp3Link" placeholder="https://dropbox.com/..." />
        </div>
        {producerTagField}
      </>
    );
  }

  if (code === "standard") {
    return (
      <>
        <div>
          <Label>MP3 Link</Label>
          <Input name="license_standard_mp3Link" placeholder="https://dropbox.com/..." />
        </div>
        <div>
          <Label>WAV Link</Label>
          <Input name="license_standard_wavLink" placeholder="https://dropbox.com/..." />
        </div>
        {producerTagField}
      </>
    );
  }

  if (code === "unlimited" || code === "exclusive") {
    return (
      <>
        <div>
          <Label>MP3 Link</Label>
          <Input name={`license_${code}_mp3Link`} placeholder="https://dropbox.com/..." />
        </div>
        <div>
          <Label>WAV Link</Label>
          <Input name={`license_${code}_wavLink`} placeholder="https://dropbox.com/..." />
        </div>
        <div>
          <Label>Stems Link</Label>
          <Input name={`license_${code}_stemsLink`} placeholder="https://dropbox.com/..." />
        </div>
        {producerTagField}
      </>
    );
  }

  return null;
}
