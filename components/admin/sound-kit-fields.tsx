"use client";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function slugifyInput(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function SoundKitFields({
  initialTitle = "",
  initialSlug = "",
  initialDescription = "",
  initialPriceCents = "",
  initialCoverImageUrl = "",
  initialPreviewMp3Url = "",
  initialDownloadUrl = "",
  initialCategory = "",
  initialTags = "",
  titleName = "title",
  slugName = "slug",
  descriptionName = "description",
  priceName = "priceCents",
  coverImageUrlName = "coverImageUrl",
  previewMp3UrlName = "previewMp3Url",
  downloadUrlName = "downloadUrl",
  categoryName = "category",
  tagsName = "tags"
}: {
  initialTitle?: string;
  initialSlug?: string;
  initialDescription?: string;
  initialPriceCents?: string | number;
  initialCoverImageUrl?: string;
  initialPreviewMp3Url?: string;
  initialDownloadUrl?: string;
  initialCategory?: string;
  initialTags?: string;
  titleName?: string;
  slugName?: string;
  descriptionName?: string;
  priceName?: string;
  coverImageUrlName?: string;
  previewMp3UrlName?: string;
  downloadUrlName?: string;
  categoryName?: string;
  tagsName?: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [slug, setSlug] = useState(initialSlug || slugifyInput(initialTitle));
  const [slugTouched, setSlugTouched] = useState(Boolean(initialSlug));
  const [description, setDescription] = useState(initialDescription);
  const [priceCents, setPriceCents] = useState(String(initialPriceCents || ""));
  const [coverImageUrl, setCoverImageUrl] = useState(initialCoverImageUrl);
  const [previewMp3Url, setPreviewMp3Url] = useState(initialPreviewMp3Url);
  const [downloadUrl, setDownloadUrl] = useState(initialDownloadUrl);
  const [category, setCategory] = useState(initialCategory);
  const [tags, setTags] = useState(initialTags);

  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugifyInput(title));
    }
  }, [title, slugTouched]);

  return (
    <>
      <div>
        <Label>Title</Label>
        <Input name={titleName} value={title} onChange={(event) => setTitle(event.target.value)} required />
      </div>
      <div>
        <Label>Slug</Label>
        <Input
          name={slugName}
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(slugifyInput(event.target.value));
          }}
          required
        />
      </div>
      <div>
        <Label>Price</Label>
        <Input
          name={priceName}
          type="number"
          min="1"
          step="1"
          value={priceCents}
          onChange={(event) => setPriceCents(event.target.value)}
          placeholder="1000"
          required
        />
        <p className="mt-2 text-xs text-foreground/45">Enter the price in cents. For $10, use 1000.</p>
      </div>
      <div>
        <Label>Category</Label>
        <Input
          name={categoryName}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="Sample pack, loop kit, drum kit"
        />
      </div>
      <div>
        <Label>Tags</Label>
        <Input
          name={tagsName}
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="ambient, melodic, wavy, gunna"
        />
      </div>
      <div className="lg:col-span-2">
        <Label>Description</Label>
        <Textarea
          name={descriptionName}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Short description for the kit."
          rows={4}
        />
      </div>
      <div className="lg:col-span-2">
        <Label>Cover art URL</Label>
        <Input
          name={coverImageUrlName}
          value={coverImageUrl}
          onChange={(event) => setCoverImageUrl(event.target.value)}
          placeholder="Dropbox image link or public image URL"
        />
      </div>
      <div className="lg:col-span-2">
        <Label>Preview sample MP3 URL</Label>
        <Input
          name={previewMp3UrlName}
          value={previewMp3Url}
          onChange={(event) => setPreviewMp3Url(event.target.value)}
          placeholder="Dropbox MP3 preview link"
        />
        <p className="mt-2 text-xs text-foreground/45">
          Optional. This sample plays through the sticky player before purchase.
        </p>
      </div>
      <div className="lg:col-span-2">
        <Label>Zip download URL</Label>
        <Input
          name={downloadUrlName}
          value={downloadUrl}
          onChange={(event) => setDownloadUrl(event.target.value)}
          placeholder="Dropbox zip file link"
          required
        />
      </div>
    </>
  );
}
