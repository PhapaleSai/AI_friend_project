'use client';

/**
 * Reads an image file and re-encodes it to a JPEG data URL, scaled down so
 * it's small enough to keep in localStorage and send to the vision model.
 *
 * `mode: 'cover'` crops to a square (used for avatars); `mode: 'contain'`
 * preserves aspect ratio within maxSize (used for shared photos).
 */
export function fileToResizedDataUrl(
  file: File,
  { maxSize = 640, quality = 0.72, mode = 'contain' }: { maxSize?: number; quality?: number; mode?: 'cover' | 'contain' } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      const img = document.createElement('img');
      img.onerror = () => reject(new Error('Failed to load image'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas unsupported')); return; }

        if (mode === 'cover') {
          canvas.width = maxSize;
          canvas.height = maxSize;
          const scale = Math.max(maxSize / img.width, maxSize / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.drawImage(img, (maxSize - w) / 2, (maxSize - h) / 2, w, h);
        } else {
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }

        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
