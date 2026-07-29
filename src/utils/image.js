/**
 * Shrink oversized photos in the browser before uploading.
 *
 * The Supabase Storage buckets cap uploads at 5MB (couple-photos,
 * inspo-gallery, borrow-catalog) and 10MB (wedding-photos, vendor-photos,
 * vendor-contracts), but multer accepts 50MB, so the server took the file
 * happily and Storage rejected it at the end. Grace Teeters hit this in March
 * 2026: "I've tried to upload a photo of us multiple times to complete the
 * Check list but it never works!" She eventually worked out on her own that it
 * had to be under 5MB. A phone photo is routinely 6 to 12MB.
 *
 * Rather than tell people about the limit, stay under it. Anything too large is
 * scaled down and re-encoded before it leaves the browser.
 */

const DEFAULT_MAX_BYTES = 4.5 * 1024 * 1024;  // headroom under the 5MB bucket cap
const DEFAULT_MAX_DIMENSION = 2400;            // plenty for a portal photo or print

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image')); };
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Returns a File small enough to upload. Non-images and files already under the
 * limit are handed back untouched. If anything goes wrong we return the
 * original rather than blocking the upload — the server error is still a better
 * outcome than a dead button.
 */
export async function shrinkImageForUpload(file, {
  maxBytes = DEFAULT_MAX_BYTES,
  maxDimension = DEFAULT_MAX_DIMENSION,
} = {}) {
  if (!file || !file.type?.startsWith('image/')) return file;
  // HEIC and friends can't be drawn to a canvas in most browsers. Leave them be.
  if (/heic|heif/i.test(file.type)) return file;
  if (file.size <= maxBytes) return file;

  try {
    const img = await loadImage(file);
    const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Step the quality down until it fits. Stops at 0.5, below that it shows.
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    for (const quality of [0.9, 0.8, 0.7, 0.6, 0.5]) {
      const blob = await canvasToBlob(canvas, type, quality);
      if (!blob) break;
      if (blob.size <= maxBytes) {
        const name = file.name.replace(/\.[^.]+$/, '') + (type === 'image/png' ? '.png' : '.jpg');
        return new File([blob], name, { type, lastModified: Date.now() });
      }
    }

    // Still too big at 2400px: halve it and take the smallest we can make.
    canvas.width = Math.round(canvas.width / 2);
    canvas.height = Math.round(canvas.height / 2);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.7);
    if (blob && blob.size <= maxBytes) {
      return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });
    }
    return file;
  } catch (err) {
    console.error('Image resize failed, uploading the original:', err);
    return file;
  }
}

/** Human-readable file size, for error messages. */
export function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
