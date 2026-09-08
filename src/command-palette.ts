import { searchQueueTracks, loadSearchPreview, type ContentsPreview } from "./lib/search-preview";
import { modalFocus } from "./lib/accessibility";
(async function commandPalette() {
  while (
    !Spicetify?.Player ||
    !Spicetify?.Platform ||
    !Spicetify?.CosmosAsync
  ) {
    await new Promise((r) => setTimeout(r, 100));
  }

  type ResultType = "track" | "album" | "artist" | "playlist";
  interface SearchResult {
    type: ResultType;
    uri: string;
    name: string;
    meta: string;
    art: string;
  }

  let filter: ResultType | 'all' = 'all';
  let shown: SearchResult[] = [];
  let previewGeneration = 0;
  let previewUri = '';
  const previewCache = new Map<string, { value: ContentsPreview; until: number }>();
  let recent: string[] = [];
  try { const saved = JSON.parse(localStorage.getItem('aurora.searches') || '[]'); if (Array.isArray(saved)) recent = saved.filter(x => typeof x === 'string' && x.length <= 200).slice(0,8); } catch {}
  let releaseFocus: (() => void) | null = null;
  let status = "";
  let paletteEl: HTMLElement | null = null;
  let inputEl: HTMLInputElement | null = null;
  let resultsEl: HTMLElement | null = null;
  let results: SearchResult[] = [];
  let selectedIdx = 0;
  const queuePending = new Set<string>();
  let hoverTimer: number | undefined;
  let searchTimer: number | null = null;
  let searchGeneration = 0;
  const queryCache = new Map<string, SearchResult[]>();

  function escapeHtml(s: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return String(s).replace(/[&<>"']/g, (c) => map[c]);
  }

  function inject(): void {
    paletteEl = document.createElement("div");
    paletteEl.id = "command-palette";
    paletteEl.className = "command-palette hidden";
    paletteEl.innerHTML = `
      <div class="cmd-backdrop"></div>
      <div class="cmd-modal" aria-label="Search Spotify">
        <header class="cmd-header">
          <div class="cmd-search-line"><span class="cmd-search-icon" aria-hidden="true">⌕</span>
            <input id="cmd-input" type="text" role="combobox" aria-label="Search Spotify" aria-expanded="true" aria-controls="cmd-results" aria-autocomplete="list"
              placeholder="What do you want to hear?" autocomplete="off" spellcheck="false" maxlength="200" />
            <button type="button" class="cmd-close" aria-label="Close search">Esc</button>
          </div>
          <div class="cmd-filters" role="group" aria-label="Filter search results">
            ${(['all','track','album','artist','playlist'] as const).map(type => `<button type="button" data-filter="${type}" aria-pressed="${type === 'all'}">${type === 'all' ? 'All' : type[0].toUpperCase()+type.slice(1)+'s'}</button>`).join('')}
          </div>
        </header>
        <div class="cmd-body">
          <section class="cmd-matches" aria-label="Search matches"><div class="cmd-section-label">Top matches</div><div id="cmd-results" class="cmd-results" role="listbox" aria-label="Search results"></div><div class="cmd-recents"></div></section>
          <aside class="cmd-preview" aria-label="Selected result preview"></aside>
        </div>
        <footer class="cmd-footer"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> <span class="cmd-enter-hint">Select</span></span><span><kbd>⇧</kbd><kbd>↵ / click</kbd> Queue</span><span><kbd>${/^Mac/i.test(navigator.platform) ? "⌘" : "Ctrl"}</kbd><kbd>O</kbd> Open</span><span><kbd>Tab</kbd> Actions</span><span><kbd>Esc</kbd> Close</span><span class="cmd-feedback" role="status"></span></footer>
      </div>
    `;
    document.body.appendChild(paletteEl);
    inputEl = paletteEl.querySelector<HTMLInputElement>("#cmd-input");
    resultsEl = paletteEl.querySelector<HTMLElement>("#cmd-results");

    paletteEl.querySelector('.cmd-close')?.addEventListener('click', hide);
    paletteEl.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(button => button.addEventListener('click', () => {
      filter = button.dataset.filter as typeof filter; selectedIdx = 0;
      paletteEl!.querySelectorAll('[data-filter]').forEach(el => el.setAttribute('aria-pressed', String((el as HTMLElement).dataset.filter === filter)));
      renderResults(); inputEl?.focus();
    }));
    inputEl?.addEventListener("input", onInput);
    inputEl?.addEventListener("keydown", onKeyDown);
    paletteEl
      .querySelector<HTMLElement>(".cmd-backdrop")
      ?.addEventListener("click", hide);
  }

  function show(): void {
    if (!paletteEl || !inputEl) return;
    invalidateSearch();
    paletteEl.classList.remove("hidden");
    inputEl.value = ""; status = ""; filter = 'all';
    paletteEl.querySelectorAll('[data-filter]').forEach(el => el.setAttribute('aria-pressed', String((el as HTMLElement).dataset.filter === filter)));
    feedback('');
    releaseFocus?.();
    releaseFocus = modalFocus(paletteEl.querySelector<HTMLElement>(".cmd-modal")!, hide);
    results = [];
    selectedIdx = 0;
    renderResults();
  }

  function invalidateSearch(): number {
    window.clearTimeout(hoverTimer);
    if (searchTimer !== null) window.clearTimeout(searchTimer);
    searchTimer = null;
    return ++searchGeneration;
  }

  function hide(): void {
    invalidateSearch(); ++previewGeneration; previewUri = "";
    paletteEl?.classList.add("hidden");
    releaseFocus?.(); releaseFocus = null;
  }

  function toggle(): void {
    if (!paletteEl) return;
    if (paletteEl.classList.contains("hidden")) show();
    else hide();
  }

  function onInput(e: Event): void {
    const query = (e.target as HTMLInputElement).value.trim();
    const generation = invalidateSearch();
    results = [];
    status = query ? "Searching…" : "";
    selectedIdx = 0;
    renderResults();
    if (!query) return;
    searchTimer = window.setTimeout(() => search(query, generation), 250);
  }

  function imgFromUri(uri: string | undefined): string {
    if (!uri) return "";
    if (uri.startsWith("spotify:image:")) {
      return "https://i.scdn.co/image/" + uri.slice("spotify:image:".length);
    }
    return uri;
  }

  function pickImage(sources: Array<{ url?: string } | undefined> | undefined): string {
    if (!sources) return "";
    // Prefer smaller images — typically index 2 is smallest, fall back to any
    const small = sources[2]?.url || sources[1]?.url || sources[0]?.url;
    return imgFromUri(small || "");
  }

  async function search(query: string, generation: number): Promise<void> {
    const cached = queryCache.get(query);
    if (cached) {
      status = cached.length ? "" : "No results";
      results = cached;
      selectedIdx = 0;
      renderResults();
      return;
    }

    const gql = Spicetify.GraphQL;
    const def = gql?.Definitions?.searchModalResults;
    if (!gql?.Request || !def) {status = "Search is unavailable on this Spotify version."; renderResults(); return;}

    try {
      const res = await gql.Request(def, {
        searchTerm: query,
        offset: 0,
        limit: 30,
        numberOfTopResults: 30,
        includeAudiobooks: false,
        includeAuthors: false,
        includePreReleases: false,
        includeLocalConcertsField: false,
        includeArtistHasConcertsField: false,
      });

      const topItems = res?.data?.searchV2?.topResultsV2?.itemsV2;
      if (!Array.isArray(topItems)) throw Error('Unsupported search response');

      const items: SearchResult[] = [];
      const artistNames = (as: { profile?: { name?: string } }[] | undefined): string =>
        (as ?? [])
          .map((a) => a.profile?.name ?? "")
          .filter(Boolean)
          .join(", ");

      for (const entry of topItems) {
        const wrapper = entry.item;
        const d = wrapper?.data;
        if (!d) continue;
        switch (wrapper.__typename) {
          case "TrackResponseWrapper":
            items.push({
              type: "track",
              uri: d.uri,
              name: d.name,
              meta: artistNames(d.artists?.items),
              art: pickImage(d.albumOfTrack?.coverArt?.sources),
            });
            break;
          case "AlbumResponseWrapper":
            items.push({
              type: "album",
              uri: d.uri,
              name: d.name,
              meta: artistNames(d.artists?.items),
              art: pickImage(d.coverArt?.sources),
            });
            break;
          case "ArtistResponseWrapper":
            items.push({
              type: "artist",
              uri: d.uri,
              name: d.profile?.name ?? d.name,
              meta: "Artist",
              art: pickImage(d.visuals?.avatarImage?.sources),
            });
            break;
          case "PlaylistResponseWrapper":
            items.push({
              type: "playlist",
              uri: d.uri,
              name: d.name,
              meta: `By ${d.ownerV2?.data?.name ?? "Unknown"}`,
              art: pickImage(d.images?.items?.[0]?.sources),
            });
            break;
          // EpisodeResponseWrapper and others intentionally skipped
        }
      }

      const valid = items.filter(item => typeof item.uri === 'string' && item.uri.startsWith(`spotify:${item.type}:`) && typeof item.name === 'string');
      items.splice(0, items.length, ...valid);
      queryCache.set(query, items);
      if (queryCache.size > 128) queryCache.delete(queryCache.keys().next().value!);
      if (generation !== searchGeneration) return;
      status = items.length ? "" : "No results";
      results = items;
      selectedIdx = 0;
      renderResults();
    } catch {
      if (generation === searchGeneration) {status = "Search failed. Change the query to retry."; renderResults();}
    }
  }

  function imageMarkup(item: SearchResult, className: string): string {
    return `<img class="${className}${item.type === 'artist' ? ' cmd-round' : ''}" alt="" ${/^https:\/\//.test(item.art) ? `src="${escapeHtml(item.art)}"` : ''} />`;
  }

  function feedback(message: string): void {
    const el = paletteEl?.querySelector('.cmd-feedback'); if (el) el.textContent = message;
  }

  function remember(): void {
    const query = inputEl?.value.trim(); if (!query) return;
    recent = [query, ...recent.filter(x => x !== query)].slice(0,8);
    try { localStorage.setItem('aurora.searches', JSON.stringify(recent)); } catch {}
  }

  function renderRecent(): void {
    const el = paletteEl!.querySelector<HTMLElement>('.cmd-recents')!;
    el.hidden = !!inputEl?.value.trim();
    el.replaceChildren();
    if (el.hidden) return;
    const title = document.createElement('p'); title.className = 'cmd-empty-title'; title.textContent = recent.length ? 'Pick up where you left off' : 'Find your next listen'; el.append(title);
    const sub = document.createElement('p'); sub.className = 'cmd-empty-sub'; sub.textContent = recent.length ? 'Your recent searches, saved on this device.' : 'Search a song, an artist, or a whole new mood.'; el.append(sub);
    recent.forEach(query => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'cmd-recent'; button.textContent = query;
      button.addEventListener('click', () => { inputEl!.value = query; inputEl!.dispatchEvent(new Event('input')); inputEl!.focus(); }); el.append(button);
    });
    if (recent.length) {
      const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'cmd-clear'; clear.textContent = 'Clear recent searches';
      clear.onclick = () => { recent = []; try { localStorage.removeItem('aurora.searches'); } catch {} renderRecent(); inputEl?.focus(); }; el.append(clear);
    }
  }

  function renderResults(): void {
    if (!resultsEl) return;
    window.clearTimeout(hoverTimer);
    shown = results.filter(r => filter === 'all' || r.type === filter);
    selectedIdx = Math.min(selectedIdx, Math.max(0, shown.length-1));
    resultsEl.setAttribute('aria-busy', String(status === 'Searching…'));
    paletteEl!.querySelector('.cmd-section-label')!.textContent = inputEl?.value.trim() ? 'Top matches' : 'Discover';
    renderRecent();
    if (!shown.length) {
      inputEl?.removeAttribute('aria-activedescendant');
      const message = status || (results.length ? 'No '+filter+'s in these top matches. Try a more specific search.' : '');
      resultsEl.innerHTML = message ? `<div role="status" class="cmd-status">${escapeHtml(message)}</div>` : '';
      if (status.startsWith('Search failed')) {
        const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'cmd-clear'; retry.textContent = 'Retry search'; retry.onclick = () => inputEl?.dispatchEvent(new Event('input')); resultsEl.append(retry);
      }
    } else {
      resultsEl.innerHTML = shown.map((r,i) => `<div class="cmd-result${i === selectedIdx ? ' selected' : ''}" data-idx="${i}" id="cmd-option-${i}" role="option" aria-selected="${i === selectedIdx}">
        ${imageMarkup(r,'cmd-result-art')}<div class="cmd-result-info"><span class="cmd-result-name">${escapeHtml(r.name)}</span><span class="cmd-result-meta">${escapeHtml(r.meta || r.type)}</span></div><span class="cmd-result-type">${r.type}</span></div>`).join('');
      resultsEl.querySelectorAll<HTMLElement>('.cmd-result').forEach(el => {
        el.addEventListener('pointermove', () => {
          const index = Number(el.dataset.idx); if (index === selectedIdx) return;
          window.clearTimeout(hoverTimer);
          hoverTimer = window.setTimeout(() => { selectedIdx = index; updateSelection(false); }, 120);
        });
        el.addEventListener('pointerleave', () => window.clearTimeout(hoverTimer));
        el.addEventListener('click', e => { window.clearTimeout(hoverTimer); selectedIdx = Number(el.dataset.idx); updateSelection(false); if (e.shiftKey) void queueItem(shown[selectedIdx]); else void act(); });
      });
    }
    updateSelection();
  }

  function updateSelection(scroll = true): void {
    window.clearTimeout(hoverTimer);
    resultsEl?.querySelectorAll<HTMLElement>('.cmd-result').forEach((el,i) => { el.classList.toggle('selected',i === selectedIdx); el.setAttribute('aria-selected',String(i === selectedIdx)); });
    const item = shown[selectedIdx];
    if (item) { inputEl?.setAttribute('aria-activedescendant',`cmd-option-${selectedIdx}`); if (scroll) resultsEl?.querySelector('.selected')?.scrollIntoView({block:'nearest'}); }
    paletteEl!.querySelector('.cmd-enter-hint')!.textContent = item ? 'Play' : 'Select';
    void renderPreview(item);
  }

  async function renderPreview(item?: SearchResult, retry = false): Promise<void> {
    const el = paletteEl!.querySelector<HTMLElement>('.cmd-preview')!;
    if (item && previewUri === item.uri && !retry) return;
    previewUri = item?.uri ?? ''; const generation = ++previewGeneration;
    feedback('');
    if (!item) { el.innerHTML = '<div class="cmd-preview-empty"><span aria-hidden="true">♫</span><p>A closer look</p><small>Select an album or playlist to peek at its tracks.</small></div>'; return; }
    el.innerHTML = `<div class="cmd-preview-heading">${imageMarkup(item,'cmd-preview-art')}<div><span class="cmd-eyebrow">${item.type}</span><h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(item.meta)}</p></div></div><div class="cmd-preview-actions"></div><div class="cmd-preview-contents"></div>`;
    const actions = el.querySelector('.cmd-preview-actions')!;
    const button = (label: string, action: (e: MouseEvent) => void, primary = false) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.className = primary ? 'cmd-primary' : ''; b.onclick = action; actions.append(b); return b; };
    button('▶ Play', e => { if (e.shiftKey) void queueItem(item); else void act(); }, true);
    button('Open '+item.type, () => openItem(item));
    if (item.type !== 'artist') {
      const queue = button('Add to queue', () => void queueItem(item));
      queue.dataset.queue = 'true'; queue.disabled = queuePending.has(item.uri);
    }
    const contents = el.querySelector<HTMLElement>('.cmd-preview-contents')!;
    if (item.type !== 'album' && item.type !== 'playlist') { contents.innerHTML = `<p class="cmd-empty-sub">${item.type === 'track' ? 'Play now, or keep the music going and add it to your queue.' : 'Open this artist to explore their music.'}</p>`; return; }
    contents.innerHTML = '<p class="cmd-status" role="status">Loading tracks…</p>'; contents.setAttribute('aria-busy','true');
    let timer: number | undefined;
    try {
      const cached = previewCache.get(item.uri);
      const data = cached && cached.until > Date.now() && !retry ? cached.value : await Promise.race([
        loadSearchPreview(item.type,item.uri), new Promise<never>((_,reject) => { timer = window.setTimeout(() => reject(Error('Timed out')),8000); }),
      ]);
      if (generation !== previewGeneration) return;
      previewCache.set(item.uri,{value:data,until:Date.now()+60000}); if (previewCache.size > 32) previewCache.delete(previewCache.keys().next().value!);
      contents.innerHTML = `<div class="cmd-section-label">${data.tracks.length ? `Preview · ${data.tracks.length} of ${Math.max(data.total,data.tracks.length)} tracks` : 'No tracks available'}</div>`;
      data.tracks.forEach((track,i) => {
        const row = document.createElement('div'); row.className = 'cmd-preview-track';
        const seconds = Math.floor(track.duration/1000);
        row.innerHTML = `<span class="cmd-track-number">${i+1}</span><div><strong>${escapeHtml(track.name)}</strong><small>${escapeHtml(track.artist)}${track.playable ? '' : ' · Unavailable'}</small></div><span>${seconds ? `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}` : ''}</span>`; contents.append(row);
      });
    } catch {
      if (generation !== previewGeneration) return;
      contents.innerHTML = '<p class="cmd-status" role="status">Couldn’t load the preview. You can still open it in Spotify.</p>';
      const retryButton = document.createElement('button'); retryButton.type = 'button'; retryButton.textContent = 'Retry preview'; retryButton.className = 'cmd-clear'; retryButton.onclick = () => void renderPreview(item,true); contents.append(retryButton);
    } finally { window.clearTimeout(timer); if (generation === previewGeneration) contents.removeAttribute('aria-busy'); }
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      hide();
      return;
    }
    if (shown.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIdx = (selectedIdx + 1) % shown.length;
      updateSelection();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIdx = (selectedIdx - 1 + shown.length) % shown.length;
      updateSelection();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (e.repeat) return;
      if (e.shiftKey) void queueItem(shown[selectedIdx]);
      else void act();
    }
  }

  async function queueItem(item: SearchResult): Promise<void> {
    if (item.type === 'artist') { feedback('Choose a track, album or playlist to add to queue.'); return; }
    const api = (Spicetify.Platform as any).PlayerAPI;
    if (!api?.addToQueue) { feedback('Queue is unavailable on this Spotify version.'); return; }
    if (queuePending.has(item.uri)) return;
    queuePending.add(item.uri);
    const generation = previewGeneration;
    const button = paletteEl?.querySelector<HTMLButtonElement>('[data-queue]');
    if (button) button.disabled = true;
    feedback('Adding to queue…');
    let timer: number | undefined;
    try {
      const tracks = await Promise.race([
        searchQueueTracks(item.type,item.uri),
        new Promise<never>((_,reject) => { timer = window.setTimeout(() => reject(Error('Queue lookup timed out')),15000); }),
      ]);
      if (!tracks.length) throw Error('No playable tracks');
      await api.addToQueue(tracks);
      if (generation === previewGeneration) { remember(); feedback(tracks.length === 1 ? 'Added to queue' : `Added ${tracks.length} tracks to queue`); }
    } catch { if (generation === previewGeneration) feedback('Couldn’t add to queue. Try again.'); }
    finally {
      window.clearTimeout(timer); queuePending.delete(item.uri);
      if (previewUri === item.uri) { const current = paletteEl?.querySelector<HTMLButtonElement>('[data-queue]'); if (current) current.disabled = false; }
    }
  }

  function openItem(item: SearchResult): void {
    remember();
    Spicetify.Platform.History.push(item.uri.replace(/^spotify:/, '/').replace(/:/g, '/'));
    hide();
  }
  async function act(): Promise<void> {
    const item = shown[selectedIdx]; if (!item) return;
    const generation = previewGeneration;
    try { await Spicetify.Player.playUri(item.uri); if (generation === previewGeneration) { remember(); hide(); } }
    catch { if (generation === previewGeneration) feedback('Couldn’t start playback. Try again.'); }
  }

  // Capture phase + stopImmediatePropagation so Spotify's native Cmd+K doesn't fire
  document.addEventListener(
    "keydown",
    (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        toggle();
        return;
      }
      if (mod && e.key.toLowerCase() === 'o' && paletteEl && !paletteEl.classList.contains('hidden')) {
        e.preventDefault(); e.stopImmediatePropagation();
        if (!e.repeat && shown[selectedIdx]) openItem(shown[selectedIdx]);
        return;
      }
      // Escape-out of browse-mode is handled by layout.ts, no-op here.
    },
    true,
  );

  inject();
})();
