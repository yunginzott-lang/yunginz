export function isDropboxUrl(value: string | null | undefined) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return /dropbox\.com$/i.test(url.hostname) || /dropboxusercontent\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

export function isDropboxFolderUrl(value: string | null | undefined) {
  if (!isDropboxUrl(value)) return false;

  try {
    const url = new URL(String(value));
    return /\/scl\/fo\//i.test(url.pathname);
  } catch {
    return false;
  }
}

export function normalizeDropboxPreviewUrl(value: string | null | undefined) {
  const input = String(value ?? "").trim();
  if (!input) return "";

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return input;
  }

  if (!isDropboxUrl(input)) {
    return input;
  }

  if (isDropboxFolderUrl(input)) {
    return input;
  }

  if (/dropbox\.com$/i.test(url.hostname)) {
    url.hostname = "dl.dropboxusercontent.com";
  }

  url.searchParams.delete("dl");
  url.searchParams.set("raw", "1");

  return url.toString();
}
