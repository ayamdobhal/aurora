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

  let paletteEl: HTMLElement | null = null;
  let inputEl: HTMLInputElement | null = null;
  let resultsEl: HTMLElement | null = null;
  let results: SearchResult[] = [];
  let selectedIdx = 0;
  let searchTimer: number | null = null;
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
      <div class="cmd-modal">
        <input id="cmd-input" type="text"
               placeholder="Search tracks, albums, artists, playlists…"
               autocomplete="off" spellcheck="false" />
        <div id="cmd-results" class="cmd-results"></div>
      </div>
    `;
    document.body.appendChild(paletteEl);
    inputEl = paletteEl.querySelector<HTMLInputElement>("#cmd-input");
    resultsEl = paletteEl.querySelector<HTMLElement>("#cmd-results");

    inputEl?.addEventListener("input", onInput);
    inputEl?.addEventListener("keydown", onKeyDown);
    paletteEl
      .querySelector<HTMLElement>(".cmd-backdrop")
      ?.addEventListener("click", hide);
  }

  function show(): void {
    if (!paletteEl || !inputEl) return;
    paletteEl.classList.remove("hidden");
    inputEl.value = "";
    inputEl.focus();
    results = [];
    selectedIdx = 0;
    renderResults();
  }

  function hide(): void {
    paletteEl?.classList.add("hidden");
  }

  function toggle(): void {
    if (!paletteEl) return;
    if (paletteEl.classList.contains("hidden")) show();
    else hide();
  }

  function onInput(e: Event): void {
    const query = (e.target as HTMLInputElement).value.trim();
    if (searchTimer !== null) window.clearTimeout(searchTimer);
    if (!query) {
      results = [];
      renderResults();
      return;
    }
    searchTimer = window.setTimeout(() => search(query), 250);
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

  async function search(query: string): Promise<void> {
    const cached = queryCache.get(query);
    if (cached) {
      results = cached;
      selectedIdx = 0;
      renderResults();
      return;
    }

    const gql = Spicetify.GraphQL;
    const def = gql?.Definitions?.searchModalResults;
    if (!gql?.Request || !def) return;

    try {
      const res = await gql.Request(def, {
        searchTerm: query,
        offset: 0,
        limit: 5,
        numberOfTopResults: 5,
        includeAudiobooks: false,
        includeAuthors: false,
        includePreReleases: false,
        includeLocalConcertsField: false,
        includeArtistHasConcertsField: false,
      });

      const topItems = res?.data?.searchV2?.topResultsV2?.itemsV2 ?? [];
      if (!Array.isArray(topItems)) return;

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

      queryCache.set(query, items);
      results = items;
      selectedIdx = 0;
      renderResults();
    } catch {
      // search fails silently; palette stays on last result set
    }
  }

  function renderResults(): void {
    if (!resultsEl) return;
    if (results.length === 0) {
      resultsEl.innerHTML = "";
      return;
    }
    resultsEl.innerHTML = results
      .map(
        (r, i) => `
        <div class="cmd-result${i === selectedIdx ? " selected" : ""}" data-idx="${i}">
          <div class="cmd-result-art" style="background-image: url('${r.art}');"></div>
          <div class="cmd-result-info">
            <span class="cmd-result-name">${escapeHtml(r.name)}</span>
            <span class="cmd-result-meta">${escapeHtml(r.meta)}</span>
          </div>
          <span class="cmd-result-type">${r.type}</span>
        </div>
      `,
      )
      .join("");

    resultsEl.querySelectorAll<HTMLElement>(".cmd-result").forEach((el) => {
      el.addEventListener("click", () => {
        selectedIdx = parseInt(el.dataset.idx ?? "0", 10);
        act();
      });
    });

    resultsEl
      .querySelector<HTMLElement>(".cmd-result.selected")
      ?.scrollIntoView({ block: "nearest" });
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      hide();
      return;
    }
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIdx = (selectedIdx + 1) % results.length;
      renderResults();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIdx = (selectedIdx - 1 + results.length) % results.length;
      renderResults();
    } else if (e.key === "Enter") {
      e.preventDefault();
      act();
    }
  }

  function act(): void {
    const item = results[selectedIdx];
    if (!item) return;

    if (item.type === "track") {
      Spicetify.Player.playUri(item.uri);
      hide();
      return;
    }

    const path = item.uri.replace(/^spotify:/, "/").replace(/:/g, "/");
    Spicetify.Platform.History.push(path);
    hide();
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
      // Escape-out of browse-mode is handled by layout.ts, no-op here.
    },
    true,
  );

  inject();
})();
