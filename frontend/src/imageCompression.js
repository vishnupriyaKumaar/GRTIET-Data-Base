// Compresses any image (a File from disk, or a canvas snapshot from the
// camera) down to a target byte size entirely in the browser, so students
// never have to fuss with a photo editor to get under the limit themselves.
//
// Strategy: draw the image onto a canvas capped at a sane max dimension,
// then re-encode as JPEG at decreasing quality; if it's still too big even
// at the lowest quality, shrink the dimensions and try the quality ladder
// again. Almost any real photo or signature settles well before the last
// rung.
const QUALITY_STEPS = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.32, 0.25, 0.2, 0.15, 0.1];

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image."));
    img.src = src;
  });
}

function drawScaled(img, maxDim) {
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // flatten any transparency (PNG) onto white before JPEG re-encode
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// source: a File/Blob, or a data URL string (e.g. from a <canvas> capture).
// Returns a Promise<File> whose size is <= maxBytes whenever that's at all
// achievable, and otherwise the smallest version it managed.
export async function compressImageToLimit(source, { maxBytes = 24 * 1024, maxDim = 420, filename = "image.jpg" } = {}) {
  const src = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    const img = await loadImage(src);
    let dim = maxDim;
    let best = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const canvas = drawScaled(img, dim);
      for (const q of QUALITY_STEPS) {
        const blob = await canvasToBlob(canvas, q);
        if (!blob) continue;
        if (!best || blob.size < best.size) best = blob;
        if (blob.size <= maxBytes) {
          return new File([blob], filename, { type: "image/jpeg" });
        }
      }
      dim = Math.round(dim * 0.75); // still too big at the lowest quality - shrink and retry
    }
    // Could not get under the limit (extremely unlikely) - hand back the
    // smallest version produced rather than blocking the student outright.
    return best ? new File([best], filename, { type: "image/jpeg" }) : null;
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(src);
  }
}
