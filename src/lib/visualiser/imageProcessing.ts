/**
 * Client-side Canvas 2D wall selection & luminance-preserving colour rendering engine.
 * Runs 100% in browser memory; zero image data leaves the client device.
 */

export interface DecodedRoomImage {
  width: number;
  height: number;
  originalPixels: Uint8ClampedArray;
  sobelEdges: Uint8Array;
}

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_RAW_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

export function validateRoomImageFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_TYPES.has(file.type)) {
    return {
      valid: false,
      error: 'Unsupported format. Please select a JPEG, PNG, or WebP photograph.',
    };
  }
  if (file.size > MAX_RAW_FILE_BYTES) {
    return {
      valid: false,
      error: 'Photograph exceeds the 20 MB limit. Please choose a smaller image.',
    };
  }
  return { valid: true };
}

/**
 * Computes normalized Sobel edge magnitude (0..255) on luminance to stop flood-fill
 * cleanly at window frames, skirting boards, and furniture boundaries.
 */
export function computeSobelEdges(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): Uint8Array {
  const len = width * height;
  const lum = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    const p = i * 4;
    lum[i] = (pixels[p] * 77 + pixels[p + 1] * 150 + pixels[p + 2] * 29) >> 8;
  }

  const edges = new Uint8Array(len);
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = row + x;
      const tl = lum[idx - width - 1];
      const tc = lum[idx - width];
      const tr = lum[idx - width + 1];
      const ml = lum[idx - 1];
      const mr = lum[idx + 1];
      const bl = lum[idx + width - 1];
      const bc = lum[idx + width];
      const br = lum[idx + width + 1];

      const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      const mag = Math.min(255, Math.abs(gx) + Math.abs(gy));
      edges[idx] = mag;
    }
  }
  return edges;
}

/**
 * Decodes an image File or URL locally and downscales proportionally to maxEdge
 * to protect browser memory on mobile devices.
 */
export async function decodeImageSource(
  source: File | string,
  maxEdge: number
): Promise<DecodedRoomImage> {
  let bitmap: ImageBitmap;
  if (typeof source === 'string') {
    const res = await fetch(source);
    if (!res.ok) throw new Error('Failed to load sample room photograph.');
    const blob = await res.blob();
    bitmap = await createImageBitmap(blob);
  } else {
    bitmap = await createImageBitmap(source);
  }

  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D context unavailable in this browser.');

    ctx.drawImage(bitmap, 0, 0, width, height);
    const imgData = ctx.getImageData(0, 0, width, height);
    const originalPixels = new Uint8ClampedArray(imgData.data);
    const sobelEdges = computeSobelEdges(originalPixels, width, height);

    return { width, height, originalPixels, sobelEdges };
  } finally {
    bitmap.close();
  }
}

/**
 * Additive perceptual flood-fill with Sobel edge stopping.
 */
export function floodFillMask(
  originalPixels: Uint8ClampedArray,
  sobelEdges: Uint8Array,
  mask: Uint8Array,
  width: number,
  height: number,
  seedX: number,
  seedY: number,
  tolerance: number
): boolean {
  const sx = Math.max(0, Math.min(width - 1, Math.round(seedX)));
  const sy = Math.max(0, Math.min(height - 1, Math.round(seedY)));
  const seedIdx = sy * width + sx;
  const sp = seedIdx * 4;

  const sr = originalPixels[sp];
  const sg = originalPixels[sp + 1];
  const sb = originalPixels[sp + 2];

  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  // Threshold scaling: perceptual distance + edge guard
  const maxColorDist = tolerance * 1.65;
  const edgeStop = Math.min(240, 85 + tolerance * 2.1);

  queue[tail++] = seedIdx;
  visited[seedIdx] = 1;
  let changed = false;

  while (head < tail) {
    const idx = queue[head++];
    if (mask[idx] !== 255) {
      mask[idx] = 255;
      changed = true;
    }

    const x = idx % width;
    const y = (idx - x) / width;

    const neighbors: number[] = [];
    if (x > 0) neighbors.push(idx - 1);
    if (x < width - 1) neighbors.push(idx + 1);
    if (y > 0) neighbors.push(idx - width);
    if (y < height - 1) neighbors.push(idx + width);

    for (let n = 0; n < neighbors.length; n++) {
      const nIdx = neighbors[n];
      if (visited[nIdx]) continue;
      visited[nIdx] = 1;

      if (sobelEdges[nIdx] > edgeStop) continue;

      const np = nIdx * 4;
      const dr = originalPixels[np] - sr;
      const dg = originalPixels[np + 1] - sg;
      const db = originalPixels[np + 2] - sb;
      const dist = Math.sqrt(0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db);

      if (dist <= maxColorDist) {
        queue[tail++] = nIdx;
      }
    }
  }

  return changed;
}

/**
 * Interpolated circular brush or eraser stroke on maskBuffer.
 */
export function paintBrushStroke(
  mask: Uint8Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  value: 0 | 255
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / Math.max(2, radius * 0.35)));
  const rSq = radius * radius;
  const rInt = Math.ceil(radius);

  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const cx = Math.round(x0 + dx * t);
    const cy = Math.round(y0 + dy * t);

    const minY = Math.max(0, cy - rInt);
    const maxY = Math.min(height - 1, cy + rInt);
    const minX = Math.max(0, cx - rInt);
    const maxX = Math.min(width - 1, cx + rInt);

    for (let y = minY; y <= maxY; y++) {
      const oy = y - cy;
      const row = y * width;
      for (let x = minX; x <= maxX; x++) {
        const ox = x - cx;
        if (ox * ox + oy * oy <= rSq) {
          mask[row + x] = value;
        }
      }
    }
  }
}

function hexToHsl(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h /= 6;
  return [h, s, l];
}

function hue2rgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

/**
 * Renders original vs. luminance-preserving tinted wall composite onto target ImageData.
 * Preserves surface texture, raking daylight, and shadow gradients.
 */
export function renderTintedComposite(
  originalPixels: Uint8ClampedArray,
  mask: Uint8Array,
  width: number,
  height: number,
  targetHex: string,
  outPixels: Uint8ClampedArray
): void {
  const [th, ts, tl] = hexToHsl(targetHex);

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const idx = row + x;
      const p = idx * 4;

      const centerMask = mask[idx];
      // Fast 3x3 edge feathering only near mask boundaries
      let alpha = centerMask / 255;
      if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
        const sum =
          mask[idx - width - 1] +
          mask[idx - width] +
          mask[idx - width + 1] +
          mask[idx - 1] +
          centerMask +
          mask[idx + 1] +
          mask[idx + width - 1] +
          mask[idx + width] +
          mask[idx + width + 1];
        if (sum > 0 && sum < 2295) {
          alpha = sum / 2295;
        }
      }

      if (alpha === 0) {
        outPixels[p] = originalPixels[p];
        outPixels[p + 1] = originalPixels[p + 1];
        outPixels[p + 2] = originalPixels[p + 2];
        outPixels[p + 3] = 255;
        continue;
      }

      const r0 = originalPixels[p] / 255;
      const g0 = originalPixels[p + 1] / 255;
      const b0 = originalPixels[p + 2] / 255;

      const max = Math.max(r0, g0, b0);
      const min = Math.min(r0, g0, b0);
      const l0 = (max + min) / 2;

      // Preserve shadow/highlight structure while allowing light finishes to brighten darker walls
      const targetWeight = tl > l0 + 0.25 ? 0.32 : 0.24;
      const lOut = Math.max(0.04, Math.min(0.96, l0 * (1 - targetWeight) + tl * targetWeight));
      const [tr, tg, tb] = hslToRgb(th, ts, lOut);

      outPixels[p] = Math.round(originalPixels[p] * (1 - alpha) + tr * alpha);
      outPixels[p + 1] = Math.round(originalPixels[p + 1] * (1 - alpha) + tg * alpha);
      outPixels[p + 2] = Math.round(originalPixels[p + 2] * (1 - alpha) + tb * alpha);
      outPixels[p + 3] = 255;
    }
  }
}
