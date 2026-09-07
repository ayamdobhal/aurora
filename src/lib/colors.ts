export type RGB = [number, number, number];

export function luminance(rgb: RGB): number {
  const linear = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

export function contrast(a: RGB, b: RGB): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Keep the artwork hue, but lift text above the brightest supported surface. */
export function readableAccent(rgb: RGB): RGB {
  const surface: RGB = [100, 100, 100];
  for (let step = 0; step <= 100; step++) {
    const candidate = rgb.map((v) => Math.round(v + (255 - v) * step / 100)) as RGB;
    if (contrast(candidate, surface) >= 4.5) return candidate;
  }
  return [255, 255, 255];
}

export function onAccent(rgb: RGB): RGB {
  return contrast(rgb, [0, 0, 0]) >= contrast(rgb, [255, 255, 255])
    ? [0, 0, 0] : [255, 255, 255];
}
