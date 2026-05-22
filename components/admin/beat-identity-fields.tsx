"use client";

import { useEffect, useMemo, useState } from "react";

import { parseBeatMetadataFromPreviewUrl, GENRE_OPTIONS } from "@/lib/beat-metadata";
import { Checkbox } from "@/components/ui/checkbox";
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

function formatDurationForInput(value: string | number) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "";
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60)
    .toString()
    .padStart(2, "0");

  return `${mins}:${secs}`;
}

export function BeatIdentityFields({
  initialTitle = "",
  initialSlug = "",
  initialGenres = "",
  initialPreviewUrl = "",
  initialBpm = "",
  initialDurationSeconds = "",
  initialMood = "",
  initialDescription = "",
  titleName = "title",
  slugName = "slug",
  genreName = "genre",
  previewUrlName = "previewMp3Url",
  bpmName = "bpm",
  durationName = "durationSeconds",
  moodName = "mood",
  descriptionName = "description"
}: {
  initialTitle?: string;
  initialSlug?: string;
  initialGenres?: string;
  initialPreviewUrl?: string;
  initialBpm?: string | number;
  initialDurationSeconds?: string | number;
  initialMood?: string;
  initialDescription?: string;
  titleName?: string;
  slugName?: string;
  genreName?: string;
  previewUrlName?: string;
  bpmName?: string;
  durationName?: string;
  moodName?: string;
  descriptionName?: string;
}) {
  const initialGenreList = useMemo(
    () =>
      initialGenres
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    [initialGenres]
  );
  const [title, setTitle] = useState(initialTitle);
  const [slug, setSlug] = useState(initialSlug || slugifyInput(initialTitle));
  const [slugTouched, setSlugTouched] = useState(Boolean(initialSlug));
  const [selectedGenres, setSelectedGenres] = useState<string[]>(initialGenreList);
  const [previewUrl, setPreviewUrl] = useState(initialPreviewUrl);
  const [bpm, setBpm] = useState(String(initialBpm || ""));
  const [durationSeconds, setDurationSeconds] = useState(
    formatDurationForInput(initialDurationSeconds)
  );
  const [mood, setMood] = useState(initialMood);
  const [description, setDescription] = useState(initialDescription);
  const [dropboxHint, setDropboxHint] = useState("");

  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugifyInput(title));
    }
  }, [title, slugTouched]);

  function toggleGenre(genre: string, checked: boolean) {
    setSelectedGenres((current) =>
      checked ? Array.from(new Set([...current, genre])) : current.filter((item) => item !== genre)
    );
  }

  function applyParsedPreviewMetadata() {
    if (!previewUrl.trim()) {
      setDropboxHint("");
      return;
    }

    const parsed = parseBeatMetadataFromPreviewUrl(previewUrl);

    if (parsed.normalizedUrl && parsed.normalizedUrl !== previewUrl) {
      setPreviewUrl(parsed.normalizedUrl);
    }

    if (parsed.title && !title.trim()) {
      setTitle(parsed.title);
    }

    if (parsed.title && !slugTouched && !slug.trim()) {
      setSlug(slugifyInput(parsed.title));
    }

    if (parsed.bpm && !bpm.trim()) {
      setBpm(parsed.bpm);
    }

    if (parsed.mood && !mood.trim()) {
      setMood(parsed.mood);
    }

    if (parsed.genres.length && selectedGenres.length === 0) {
      setSelectedGenres(parsed.genres);
    }

    setDropboxHint(
      parsed.looksLikeFolderLink
        ? "This looks like a Dropbox folder-share link. For playback, open the MP3 file itself in Dropbox, click Share, and copy the file link instead."
        : "Dropbox file link detected. The app will normalize it for streaming."
    );
  }

  return (
    <>
      <div className="lg:col-span-2">
        <Label>Preview MP3 URL</Label>
        <Input
          name={previewUrlName}
          value={previewUrl}
          onChange={(event) => setPreviewUrl(event.target.value)}
          onBlur={applyParsedPreviewMetadata}
          placeholder="Paste Dropbox shared file link for the beat preview"
          required
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={applyParsedPreviewMetadata}
            className="rounded-full border border-primary/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary transition hover:border-primary hover:bg-primary hover:text-black"
          >
            Auto-fill from filename
          </button>
          <span className="text-xs text-foreground/45">
            Paste a Dropbox file link and the form will try to extract title, BPM, genre, and mood.
          </span>
        </div>
        {dropboxHint ? <div className="mt-2 text-xs text-foreground/55">{dropboxHint}</div> : null}
      </div>
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
      <div className="lg:col-span-2">
        <Label>Genres</Label>
        <input type="hidden" name={genreName} value={selectedGenres.join(", ")} readOnly />
        <div className="mt-3 flex flex-wrap gap-3">
          {GENRE_OPTIONS.map((genre) => {
            const checked = selectedGenres.includes(genre);
            return (
              <label
                key={genre}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs uppercase tracking-[0.18em] text-foreground/72"
              >
                <Checkbox
                  checked={checked}
                  onChange={(event) => toggleGenre(genre, event.target.checked)}
                />
                <span>{genre}</span>
              </label>
            );
          })}
        </div>
      </div>
      <div>
        <Label>BPM</Label>
        <Input
          name={bpmName}
          type="number"
          value={bpm}
          onChange={(event) => setBpm(event.target.value)}
          required
        />
      </div>
      <div>
        <Label>Track Length</Label>
        <Input
          name={durationName}
          value={durationSeconds}
          onChange={(event) => setDurationSeconds(event.target.value)}
          placeholder="e.g. 3:09"
        />
        <p className="mt-2 text-xs text-foreground/45">
          Enter duration the way it should appear on the site, like 3:09.
        </p>
      </div>
      <div>
        <Label>Mood</Label>
        <Input name={moodName} value={mood} onChange={(event) => setMood(event.target.value)} required />
      </div>
      <div className="lg:col-span-2">
        <Label>Description</Label>
        <Textarea
          name={descriptionName}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Short description for the beat preview modal."
          rows={4}
        />
      </div>
    </>
  );
}
