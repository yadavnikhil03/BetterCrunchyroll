/**
 * Extracts a dominant, vibrant HSL color from an image URL using a canvas.
 */
const colorCache = new Map<string, string>();

/** Converts RGB to HSL [0-360, 0-1, 0-1] */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return [h, s, l];
}

export async function extractDominantColor(imgUrl: string): Promise<string | null> {
  if (!imgUrl) return null;
  if (colorCache.has(imgUrl)) {
    return colorCache.get(imgUrl)!;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Important for canvas CORS
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }

        // Downscale for performance
        const size = 64;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);

        const data = ctx.getImageData(0, 0, size, size).data;
        
        // Group colors by Hue bins (e.g. 15 degree intervals) to find the most prominent color
        const bins = new Map<number, { count: number; hSum: number; sSum: number; lSum: number }>();

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]!;
          const g = data[i + 1]!;
          const b = data[i + 2]!;
          const a = data[i + 3]!;

          if (a < 128) continue; // Skip transparent

          const [h, s, l] = rgbToHsl(r, g, b);

          // Skip completely greyscale, too dark, or too bright pixels
          if (s < 0.15 || l < 0.15 || l > 0.85) continue;

          const binIndex = Math.floor(h / 15);
          const bin = bins.get(binIndex) || { count: 0, hSum: 0, sSum: 0, lSum: 0 };
          bin.count++;
          bin.hSum += h;
          bin.sSum += s;
          bin.lSum += l;
          bins.set(binIndex, bin);
        }

        let bestBin = null;
        let maxCount = 0;
        for (const bin of bins.values()) {
          if (bin.count > maxCount) {
            maxCount = bin.count;
            bestBin = bin;
          }
        }

        if (!bestBin) {
          resolve(null);
          return;
        }

        const avgH = bestBin.hSum / bestBin.count;
        let avgS = bestBin.sSum / bestBin.count;
        let avgL = bestBin.lSum / bestBin.count;

        // Force minimum saturation and lightness so it acts as a good UI accent
        avgS = Math.max(avgS * 100, 60); // At least 60% saturation
        avgL = Math.max(Math.min(avgL * 100, 70), 50); // Clamp lightness between 50-70%

        const hsl = `hsl(${Math.round(avgH)} ${Math.round(avgS)}% ${Math.round(avgL)}%)`;
        colorCache.set(imgUrl, hsl);
        resolve(hsl);
      } catch (err) {
        // e.g. Tainted canvas due to CORS block from CR's CDN
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imgUrl;
  });
}
