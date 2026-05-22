"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";
import { upload } from "@vercel/blob/client";

type AssetUploaderProps = {
  folder: string;
  name: string;
  label: string;
  accept: string;
  defaultValue?: string;
  uploadAuth?: {
    userId: string;
    scope: string;
    expiresAt: number;
    signature: string;
  };
};

function getFileExtension(file: File) {
  const nameParts = file.name.split(".");
  if (nameParts.length > 1) {
    return `.${nameParts[nameParts.length - 1].toLowerCase()}`;
  }

  if (file.type === "image/png") return ".png";
  if (file.type === "image/webp") return ".webp";
  if (file.type === "image/avif") return ".avif";
  if (file.type === "image/jpeg") return ".jpg";
  if (file.type === "audio/mpeg") return ".mp3";
  return "";
}

async function sha256Hex(file: File) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function AssetUploader({
  folder,
  name,
  label,
  accept,
  defaultValue = "",
  uploadAuth
}: AssetUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState(defaultValue);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const acceptList = useMemo(
    () => accept.split(",").map((entry) => entry.trim()).filter(Boolean),
    [accept]
  );

  async function uploadFile(file: File) {
    const lowerName = file.name.toLowerCase();
    const isAccepted =
      acceptList.length === 0 ||
      acceptList.some((entry) => {
        if (entry.startsWith(".")) {
          return lowerName.endsWith(entry.toLowerCase());
        }
        if (entry.endsWith("/*")) {
          return file.type.startsWith(entry.replace("/*", "/"));
        }
        return file.type === entry;
      });

    const looksLikeMp3 = lowerName.endsWith(".mp3");

    if (!isAccepted && folder === "previews" && !looksLikeMp3) {
      toast.error("Please upload an MP3 preview file.");
      setErrorMessage("Preview uploads must be MP3 files.");
      return;
    }

    setPending(true);
    setProgress(0);
    setErrorMessage("");

    try {
      const safeFileName = file.name.replace(/[^\w.-]+/g, "-");
      const pathname =
        folder === "covers"
          ? `${folder}/${await sha256Hex(file)}${getFileExtension(file)}`
          : `${folder}/${Date.now()}-${safeFileName}`;

      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/uploads",
        headers: uploadAuth
          ? {
              "x-upload-user": uploadAuth.userId,
              "x-upload-scope": uploadAuth.scope,
              "x-upload-expires": String(uploadAuth.expiresAt),
              "x-upload-signature": uploadAuth.signature
            }
          : undefined,
        contentType: file.type || undefined,
        multipart: file.size > 5 * 1024 * 1024,
        onUploadProgress(progressEvent) {
          setProgress(progressEvent.percentage);
        }
      });

      setValue(blob.url);
      setProgress(100);
      toast.success(`${label} uploaded`);
    } catch (error) {
      console.error("Client upload failed", error);
      const message =
        error instanceof Error
          ? error.message
          : "Upload failed.";
      const normalizedMessage = /private store/i.test(message)
        ? "Your Vercel Blob store is set to private. Switch the Blob store to public in Vercel Storage so preview MP3s and cover art can upload and play on the site."
        : message;

      toast.error(normalizedMessage);
      setErrorMessage(normalizedMessage);
      setProgress(0);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="mb-2 block text-xs uppercase tracking-[0.3em] text-foreground/65">
        {label}
      </label>
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files?.[0];
          if (file) void uploadFile(file);
        }}
        className="flex min-h-32 cursor-pointer flex-col items-center justify-center border border-dashed border-white/15 bg-black/20 px-4 py-6 text-center"
        onClick={() => inputRef.current?.click()}
      >
        <UploadCloud className="h-6 w-6 text-primary" />
        <div className="mt-3 text-sm uppercase tracking-[0.25em] text-foreground/65">
          {pending ? "Uploading..." : "Drop file or click to upload"}
        </div>
        <div className="mt-2 text-xs text-foreground/35">{accept}</div>
        <div className="mt-4 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
          <div
            className="h-2 bg-primary transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-foreground/45">
          {pending ? `${Math.round(progress)}%` : value ? "Uploaded" : "Idle"}
        </div>
      </div>
      {errorMessage ? (
        <div className="text-sm text-red-300/90">{errorMessage}</div>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadFile(file);
        }}
      />
      <input type="hidden" name={name} value={value} readOnly />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="h-12 w-full border border-white/10 bg-black/20 px-4 text-base text-foreground outline-none transition-all placeholder:text-foreground/30 focus:border-primary"
        placeholder="Uploaded asset URL will appear here"
      />
    </div>
  );
}
