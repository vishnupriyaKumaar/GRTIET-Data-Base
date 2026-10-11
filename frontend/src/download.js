// Saves a Blob as a file on every device: Windows, macOS, Linux, Android/Pixel and iPhone/iPad.
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  if ("download" in a) {
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else {
    window.open(url, "_blank"); // very old iOS: opens the file so it can be saved from there
  }
  // keep the link alive a few seconds - iOS Safari needs this to finish the download
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}

export async function blobErrorMessage(err, fallback) {
  try {
    const text = await err.response?.data?.text?.();
    if (text) return JSON.parse(text).message || fallback;
  } catch { /* keep fallback */ }
  return err.response?.data?.message || fallback;
}
