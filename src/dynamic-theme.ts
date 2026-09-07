import { onAccent, readableAccent } from "./lib/colors";

(async function dynamicTheme() {
  while (!Spicetify?.Player?.addEventListener || !Spicetify?.Player?.data) {
    await new Promise((r) => setTimeout(r, 100));
  }

  const HUE_BINS = 16;
  const SAT_MIN = 0.15;
  const LIGHT_MIN = 0.1;
  const LIGHT_MAX = 0.9;
  const DEBOUNCE_MS = 300;

  type Accent = { h: number; s: number; l: number };
  type RGB = [number, number, number];

  const cache = new Map<string, Accent | null>();
  const CACHE_LIMIT = 128;
  let generation = 0;
  let debounceTimer: number | null = null;

  function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }
    return [h, s, l];
  }

  function hslToRgb(h: number, s: number, l: number): RGB {
    if (s === 0) {
      const v = Math.round(l * 255);
      return [v, v, v];
    }
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [
      Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
      Math.round(hue2rgb(p, q, h) * 255),
      Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
    ];
  }

  function rgbToHex([r, g, b]: RGB): string {
    return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
  }

  function toHttpUrl(url: string | undefined): string | null {
    if (!url) return null;
    if (url.startsWith("spotify:image:")) {
      return "https://i.scdn.co/image/" + url.slice("spotify:image:".length);
    }
    return url;
  }

  function extractAccent(imageUrl: string): Promise<Accent | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 64;
          canvas.height = 64;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0, 64, 64);
          const { data } = ctx.getImageData(0, 0, 64, 64);

          const buckets = Array.from({ length: HUE_BINS }, () => ({
            count: 0,
            sumS: 0,
            sumL: 0,
          }));

          for (let i = 0; i < data.length; i += 4) {
            const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
            if (s < SAT_MIN || l < LIGHT_MIN || l > LIGHT_MAX) continue;
            const bin = Math.min(Math.floor(h * HUE_BINS), HUE_BINS - 1);
            buckets[bin].count++;
            buckets[bin].sumS += s;
            buckets[bin].sumL += l;
          }

          let bestIdx = -1;
          let bestCount = 0;
          for (let i = 0; i < HUE_BINS; i++) {
            if (buckets[i].count > bestCount) {
              bestCount = buckets[i].count;
              bestIdx = i;
            }
          }

          if (bestIdx === -1) return resolve(null);

          const b = buckets[bestIdx];
          resolve({
            h: (bestIdx + 0.5) / HUE_BINS,
            s: b.sumS / b.count,
            l: b.sumL / b.count,
          });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = imageUrl;
    });
  }

  function setVar(name: string, rgb: RGB): void {
    const root = document.documentElement;
    root.style.setProperty(`--spice-${name}`, rgbToHex(rgb));
    root.style.setProperty(`--spice-rgb-${name}`, rgb.join(","));
  }

  let displayed: RGB = [255,255,255];
  let transitionFrame: number | null = null;
  function applyAccent(accent: Accent | null, interpolated?: RGB): void {
    const root = document.documentElement;
    const isLight =
      getComputedStyle(root).getPropertyValue("--is_light").trim() === "1";

    let h: number, s: number, l: number;
    if (accent === null) {
      h = 0;
      s = 0;
      l = isLight ? 0 : 1;
    } else {
      h = accent.h;
      s = accent.s;
      l = isLight ? 0.35 : 0.45;
    }

    if (interpolated) [h,s,l] = rgbToHsl(...interpolated);
    const main = interpolated ?? hslToRgb(h, s, l);
    displayed = main;
    // Skip setVar("text") — accent-colored text looks muddy over the
    // translucent blurred bg. Leave --spice-text at Spotify's default.
    setVar("button", hslToRgb(h, s, Math.max(0, l - (isLight ? 0.1 : 0.08))));
    setVar("sidebar", hslToRgb(h, s, Math.max(0, l - (isLight ? 0.1 : 0.08))));
    setVar(
      "button-active",
      hslToRgb(h, s, Math.max(0, l - (isLight ? 0.15 : 0.12))),
    );
    setVar("tab-active", hslToRgb(h, s, isLight ? 0.9 : 0.14));
    setVar("button-disabled", hslToRgb(h, s, isLight ? 0.9 : 0.14));
    setVar("highlight", hslToRgb(h, s, isLight ? 0.9 : 0.1));

    const mainHex = rgbToHex(main);
    const textAccent = readableAccent(main);
    root.style.setProperty("--aurora-accent-fill", mainHex);
    root.style.setProperty("--aurora-on-accent", rgbToHex(onAccent(main)));
    root.style.setProperty("--aurora-accent-text", rgbToHex(textAccent));
    root.style.setProperty("--lyrics-accent", rgbToHex(textAccent));
    root.style.setProperty("--rgb-lyrics-accent", textAccent.join(","));

    root.style.setProperty("--essential-bright-accent", rgbToHex(textAccent));
    root.style.setProperty("--background-bright-accent", mainHex);
    root.style.setProperty("--decorative-base", mainHex);
  }

  async function updateTheme(): Promise<void> {
    const track = Spicetify.Player.data?.item;
    if (!track) {
      if (transitionFrame !== null) cancelAnimationFrame(transitionFrame);
      applyAccent(null);
      document.documentElement.style.removeProperty("--aurora-next-image");
      document.documentElement.style.setProperty("--aurora-art-mix", "0");
      document.documentElement.style.removeProperty("--image_url");
      return;
    }

    const requestGeneration = generation;
    const meta = track.metadata || {};
    const bgUrl = toHttpUrl(meta.image_large_url || meta.image_url);
    const extractUrl = toHttpUrl(
      meta.image_small_url || meta.image_url || meta.image_large_url,
    );
    if (!bgUrl || !extractUrl) {
      if (transitionFrame !== null) cancelAnimationFrame(transitionFrame);
      applyAccent(null);
      document.documentElement.style.removeProperty("--aurora-next-image");
      document.documentElement.style.setProperty("--aurora-art-mix", "0");
      document.documentElement.style.removeProperty("--image_url");
      return;
    }

    // Decode artwork before presenting it, so the fade never exposes a blank frame.
    if (typeof Image.prototype.decode === "function") {
      const decoded = new Image(); decoded.src = bgUrl;
      try { await decoded.decode(); } catch {
        if (requestGeneration !== generation) return;
        if (transitionFrame !== null) cancelAnimationFrame(transitionFrame);
        const style = document.documentElement.style;
        style.removeProperty('--image_url'); style.removeProperty('--aurora-next-image'); style.setProperty('--aurora-art-mix', '0');
        applyAccent(null); return;
      }
    }
    const accent = cache.has(extractUrl) ? cache.get(extractUrl)! : await extractAccent(extractUrl);
    // Album tracks share artwork; retain only a bounded number of palettes.
    cache.set(extractUrl, accent);
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    // A slower previous cover must not repaint a newer song's theme.
    if (requestGeneration === generation) transition(bgUrl, accent, requestGeneration);
  }

  function transition(url: string, accent: Accent | null, revision: number): void {
    const root = document.documentElement.style;
    if (transitionFrame !== null) cancelAnimationFrame(transitionFrame);
    const previousNext = root.getPropertyValue('--aurora-next-image');
    if (previousNext) root.setProperty('--image_url', previousNext);
    root.setProperty('--aurora-next-image', `url("${url}")`);
    root.setProperty('--aurora-art-mix', '0');
    const from = displayed;
    const light = getComputedStyle(document.documentElement).getPropertyValue('--is_light').trim() === '1';
    const target: RGB = accent ? hslToRgb(accent.h, accent.s, light ? .35 : .45) : light ? [0,0,0] : [255,255,255];
    const instant = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !root.getPropertyValue('--image_url');
    const started = performance.now();
    const tick = () => {
      transitionFrame = null;
      if (revision !== generation) return;
      const t = instant ? 1 : Math.min(1, (performance.now()-started)/500);
      const eased = t*t*(3-2*t);
      applyAccent(accent, from.map((v,i) => Math.round(v+(target[i]-v)*eased)) as RGB);
      root.setProperty('--aurora-art-mix', String(eased));
      if (t < 1) transitionFrame = requestAnimationFrame(tick);
      else {root.setProperty('--image_url', `url("${url}")`);root.removeProperty('--aurora-next-image');root.setProperty('--aurora-art-mix','0');}
    };
    tick();
  }

  function scheduleUpdate(): void {
    generation++;
    if (debounceTimer !== null) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(updateTheme, DEBOUNCE_MS);
  }

  Spicetify.Player.addEventListener("songchange", scheduleUpdate);
  scheduleUpdate();
})();
