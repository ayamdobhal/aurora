// Keep a stable image node and present a new source only after it is decoded.
const pending = new WeakMap<HTMLImageElement, { url: string; revision: number }>();
export function syncArtwork(target: HTMLImageElement, url: string): void {
  const previous = pending.get(target);
  if (previous?.url === url) return;
  const state = { url, revision: (previous?.revision ?? 0) + 1 };
  pending.set(target, state);
  if (!url) { target.removeAttribute('src'); return; }
  const image = new Image();
  const current = () => pending.get(target) === state && target.isConnected;
  let timer: number;
  const ready = new Promise<void>((resolve, reject) => {
    timer = window.setTimeout(() => reject(Error('Artwork timed out')), 10000);
    image.onload = () => { if (typeof image.decode !== 'function') resolve(); }; image.onerror = () => reject(Error('Artwork unavailable'));
    image.src = url;
    if (typeof image.decode === 'function') image.decode().then(resolve, reject);
  });
  void ready.then(() => { if (current()) target.src = url; }, () => {
    if (current()) { target.removeAttribute('src'); pending.delete(target); }
  }).finally(() => { clearTimeout(timer); image.onload = image.onerror = null; });
}
