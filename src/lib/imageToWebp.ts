// Client-side image → webp converter. Uses a detached canvas so we don't
// touch the DOM. Preserves natural dimensions; quality defaults to 0.9 to
// match what the user asked for.

export async function convertToWebp(file: File | Blob, quality = 0.9): Promise<Blob> {
  const bitmap = await loadBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 canvas 2D 上下文');
  ctx.drawImage(bitmap, 0, 0);
  // Free the bitmap ASAP — large photos hold a lot of GPU memory.
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('canvas.toBlob 返回 null，可能不支持 webp')),
      'image/webp',
      quality,
    );
  });
}

async function loadBitmap(file: File | Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file); } catch { /* fall through */ }
  }
  // Fallback for older browsers or HEIC blobs that createImageBitmap rejects.
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('图片加载失败'));
    });
    return img;
  } finally {
    // URL.revokeObjectURL is safe once the image is drawn to canvas.
    URL.revokeObjectURL(url);
  }
}

// GitHub Contents API requires base64-encoded content. Browser atob/btoa
// only handle latin-1, so we go through FileReader for binary safety.
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result is "data:<mime>;base64,<payload>" — strip the prefix.
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('读取 blob 失败'));
    reader.readAsDataURL(blob);
  });
}
