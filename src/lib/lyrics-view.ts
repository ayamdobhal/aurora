import { invalidateLyrics, requestLyrics, playbackProgress, type SyncedLine, type Lyrics } from "./lyrics-service";
import { preferences, savePreferences, setTrackOffset, trackOffset, type Provider } from "./preferences";
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#39;"}[c]!));
  function renderSynced(lines: SyncedLine[]): string {
    const inner = lines
      .map((l, i) => {
        if (l.words) {
          const mainHtml = l.words
            .map(
              (w, wi) =>
                `<span class="lyric-word" data-widx="${wi}">${escapeHtml(w.text)}</span>`,
            )
            .join("");
          let bgHtml = "";
          if (l.bgWords && l.bgWords.length > 0) {
            const bgInner = l.bgWords
              .map(
                (w, wi) =>
                  `<span class="lyric-word bg" data-bgwidx="${wi}">${escapeHtml(w.text)}</span>`,
              )
              .join("");
            bgHtml = ` <span class="lyric-bg">${bgInner}</span>`;
          }
          return `<button type="button" class="lyric-line enhanced" data-idx="${i}">${mainHtml || "&#9834;"}${bgHtml}</button>`;
        }
        return `<button type="button" class="lyric-line" data-idx="${i}">${escapeHtml(l.text) || "&#9834;"}</button>`;
      })
      .join("");
    return `<div class="lyrics-synced">${inner}</div>`;
  }

  function renderUnsynced(text: string): string {
    const inner = text
      .split("\n")
      .map((l) => `<div class="lyric-line-plain">${escapeHtml(l)}</div>`)
      .join("");
    return `<div class="lyrics-unsynced">${inner}</div>`;
  }


export function mountLyricsView(root: HTMLElement, visible: () => boolean = () => true) {
  const doc = root.ownerDocument, win = doc.defaultView!;
  let disposed = false, generation = 0, uri = '', provider = preferences().provider;
  let data: Lyrics = { type: 'none' }, frame: number | null = null, active = -2, following = true;
  root.classList.add('aurora-lyrics-view');
  root.innerHTML = `<div class="lyrics-tools">
    <label>Source <select aria-label="Lyrics source"><option value="auto">Auto</option><option value="amll">AMLL</option><option value="lrclib">lrclib</option><option value="spotify">Spotify</option></select></label>
    <button type="button" data-offset="-50" aria-label="Show lyrics later by 50 milliseconds">−</button><output aria-label="Lyrics timing"></output><button type="button" data-offset="50" aria-label="Show lyrics earlier by 50 milliseconds">+</button>
    <button type="button" data-reset>Reset timing</button><button type="button" data-retry>Retry</button>
  </div><div class="lyrics-content" aria-busy="true"></div><button type="button" class="lyrics-follow" hidden>Back to current line</button>`;
  const content = root.querySelector<HTMLElement>('.lyrics-content')!;
  const select = root.querySelector<HTMLSelectElement>('select')!;
  const output = root.querySelector('output')!;
  const follow = root.querySelector<HTMLButtonElement>('.lyrics-follow')!;
  if (root.classList.contains('mp-tab-pane')) {
    for (const [selector, label, glyph] of [['[data-reset]', 'Reset timing', '↺'], ['[data-retry]', 'Retry lyrics', '↻']]) {
      const button = root.querySelector<HTMLButtonElement>(selector)!;
      button.textContent = glyph; button.title = label; button.setAttribute('aria-label', label);
    }
  }
  function controls() { select.value = preferences().provider; output.textContent = `${trackOffset(uri) > 0 ? '+' : ''}${trackOffset(uri)}ms`; }
  function center() {
    if (!following || !visible()) return;
    content.querySelector<HTMLElement>('.lyric-line.active')?.scrollIntoView({ behavior: win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  }
  function suspend() { following = false; follow.hidden = false; }
  content.addEventListener('wheel', suspend, { passive: true });
  content.addEventListener('touchmove', suspend, { passive: true });
  content.addEventListener('pointerdown', e => { if (!(e.target as Element).closest('.lyric-line')) suspend(); });
  content.addEventListener('keydown', e => { if (['ArrowDown','ArrowUp','PageDown','PageUp','Home','End'].includes(e.key)) suspend(); });
  follow.addEventListener('click', () => { following = true; follow.hidden = true; center(); });
  select.addEventListener('change', () => savePreferences({ provider: select.value as Provider }));
  root.querySelectorAll<HTMLElement>('[data-offset]').forEach(b => b.addEventListener('click', () => setTrackOffset(trackOffset(uri) + Number(b.dataset.offset), uri)));
  root.querySelector('[data-reset]')!.addEventListener('click', () => setTrackOffset(0, uri));
  root.querySelector('[data-retry]')!.addEventListener('click', () => {invalidateLyrics(uri);document.dispatchEvent(new CustomEvent('aurora-lyrics-retry'));});
  content.addEventListener('click', e => {
    const el = (e.target as Element).closest<HTMLElement>('.lyric-line');
    if (!el || data.type !== 'synced') return;
    const line = data.lines[Number(el.dataset.idx)];
    if (line) { Spicetify.Player.seek(Math.max(0, Math.round(line.time * 1000 - trackOffset(uri)))); active = -2; tick(); }
  });
  function tick() {
    if (frame !== null) win.cancelAnimationFrame(frame); frame = null;
    if (disposed || !root.isConnected) return;
    if (data.type === 'synced') {
      const seconds = (playbackProgress() + trackOffset(uri)) / 1000;
      let idx = -1; for (let i = 0; i < data.lines.length && data.lines[i].time <= seconds; i++) idx = i;
      if (idx !== active) {
        active = idx;
        content.querySelectorAll<HTMLElement>('.lyric-line').forEach((el, i) => {
          el.classList.toggle('active', i === idx); el.classList.toggle('past', i < idx);
          el.setAttribute('aria-current', i === idx ? 'true' : 'false');
          if (i !== idx) el.querySelectorAll<HTMLElement>('.lyric-word').forEach(word => word.style.setProperty('--word-progress', i < idx ? '120%' : '-20%'));
        });
        center();
      }
      content.querySelectorAll<HTMLElement>('.lyric-line.active').forEach(el => {
        const line = (data as { lines: SyncedLine[] }).lines[active];
        for (const [words, selector] of [[line.words, '.lyric-word:not(.bg)'], [line.bgWords, '.lyric-word.bg']] as const) {
          el.querySelectorAll<HTMLElement>(selector).forEach((word, wi) => {
            const w = words?.[wi]; if (!w) return;
            const progress = -20 + 140 * Math.max(0, Math.min(1, (seconds - w.time) / Math.max(.05, w.endTime - w.time)));
            word.style.setProperty('--word-progress', `${progress}%`);
          });
        }
      });
    }
    if (visible() && doc.visibilityState !== 'hidden' && !Spicetify.Player.data?.isPaused && data.type === 'synced') frame = win.requestAnimationFrame(tick);
  }
  async function render(retry = false) {
    const track = Spicetify.Player.data?.item;
    if (!track) { generation++; uri = ''; data = {type:'none'}; content.textContent = 'Nothing playing'; content.setAttribute('aria-busy','false'); tick(); return; }
    if (!retry && uri === track.uri && provider === preferences().provider) { tick(); return; }
    uri = track.uri; provider = preferences().provider;
    const g = ++generation; data = {type:'none'}; following = true; follow.hidden = true; active = -2;
    controls(); tick(); content.textContent = 'Loading lyrics…'; content.setAttribute('aria-busy','true');
    const result = await requestLyrics(track, provider, retry);
    if (disposed || g !== generation || !root.isConnected) return;
    data = result.lyrics; content.setAttribute('aria-busy','false');
    root.dataset.provider = result.provider;
    content.innerHTML = data.type === 'synced' ? renderSynced(data.lines) : data.type === 'unsynced' ? renderUnsynced(data.text)
      : `<div class="lyrics-empty" role="status">${data.type === 'error' ? 'Lyrics couldn’t load. Try another source or retry.' : data.type === 'instrumental' ? 'Instrumental' : 'Lyrics not available'}</div>`;
    tick();
  }
  const onPrefs = (event: Event) => {
    controls();
    if ((event as CustomEvent<string[]>).detail?.includes('provider')) void render();
    else { active = -2; tick(); }
  };
  const retry = () => {uri = ''; void render();};
  document.addEventListener('aurora-lyrics-retry', retry);
  document.addEventListener('aurora-preferences', onPrefs);
  // One application listener per event fans out to mounted views, including PiP.
  type Hub = { views: Set<() => void> };
  const host = window as unknown as { __auroraLyricsViews?: Hub };
  if (!host.__auroraLyricsViews) {
    const hub: Hub = host.__auroraLyricsViews = { views: new Set() };
    for (const event of ['songchange','onplaypause','onprogress'] as const)
      Spicetify.Player.addEventListener(event, () => hub.views.forEach(fn => fn()));
  }
  const refresh = () => { void render(); };
  host.__auroraLyricsViews.views.add(refresh);
  doc.addEventListener('visibilitychange', tick);
  const observer = new MutationObserver(tick);
  observer.observe(document.body, {attributes:true,attributeFilter:['class']});
  void render();
  return { render, refresh: tick, dispose() {
    disposed = true; generation++; if (frame !== null) win.cancelAnimationFrame(frame);
    observer.disconnect(); document.removeEventListener('aurora-preferences', onPrefs); document.removeEventListener('aurora-lyrics-retry', retry);
    doc.removeEventListener('visibilitychange', tick); host.__auroraLyricsViews?.views.delete(refresh);
  }};
}
