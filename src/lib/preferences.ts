export type Provider = "auto" | "amll" | "lrclib" | "spotify";
export type Preferences = {
  version: 1;
  sidebar: "queue" | "recent" | "friends" | "devices";
  miniTab: "lyrics" | "queue";
  miniExpanded: boolean;
  provider: Provider;
  offsets: Record<string, number>;
};
const KEY = "aurora:preferences:v1";
const host = window as unknown as { __auroraPreferences?: Preferences };
export function validatePreferences(value: unknown): Preferences {
  const p = (value && typeof value === "object" ? value : {}) as Partial<Preferences>;
  const offsets: Record<string, number> = {};
  if (p.version === 1 && p.offsets && typeof p.offsets === "object")
    for (const [uri, ms] of Object.entries(p.offsets).slice(-200))
      if (uri.startsWith("spotify:track:") && typeof ms === "number" && Number.isFinite(ms))
        offsets[uri] = Math.max(-10000, Math.min(10000, Math.round(ms)));
  return {
    version: 1,
    sidebar: ["queue", "recent", "friends", "devices"].includes(p.sidebar ?? "") ? p.sidebar! : "queue",
    miniTab: p.miniTab === "queue" ? "queue" : "lyrics",
    miniExpanded: typeof p.miniExpanded === "boolean" ? p.miniExpanded : true,
    provider: ["auto", "amll", "lrclib", "spotify"].includes(p.provider ?? "") ? p.provider! : "auto",
    offsets,
  };
}
export function preferences(): Preferences {
  if (!host.__auroraPreferences) {
    try { host.__auroraPreferences = validatePreferences(JSON.parse(localStorage.getItem(KEY) || "null")); }
    catch { host.__auroraPreferences = validatePreferences(null); }
  }
  return host.__auroraPreferences;
}
export function savePreferences(patch: Partial<Preferences>): void {
  host.__auroraPreferences = validatePreferences({ ...preferences(), ...patch });
  try { localStorage.setItem(KEY, JSON.stringify(host.__auroraPreferences)); } catch { /* Keep session preferences. */ }
  document.dispatchEvent(new CustomEvent("aurora-preferences", { detail: Object.keys(patch) }));
}
export function trackOffset(uri = Spicetify.Player.data?.item?.uri ?? ""): number {
  return preferences().offsets[uri] ?? 0;
}
export function setTrackOffset(ms: number, uri = Spicetify.Player.data?.item?.uri ?? ""): void {
  if (!uri.startsWith("spotify:track:")) return;
  const offsets = { ...preferences().offsets };
  delete offsets[uri];
  offsets[uri] = ms;
  savePreferences({ offsets });
}
