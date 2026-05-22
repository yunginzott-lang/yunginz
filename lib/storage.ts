import { del, put } from "@vercel/blob";

export async function uploadPublicAsset(file: File, pathname: string) {
  const token = (process.env.BLOB_READ_WRITE_TOKEN || "").trim();

  if (!token) {
    throw new Error("Blob storage is not configured.");
  }

  const blob = await put(pathname, file, {
    access: "public",
    token
  });

  return blob;
}

export async function deletePublicAsset(url: string | null | undefined) {
  const token = (process.env.BLOB_READ_WRITE_TOKEN || "").trim();

  if (!token || !url) {
    return;
  }

  await del(url, { token });
}
