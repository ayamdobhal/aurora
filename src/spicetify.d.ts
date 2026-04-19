// Minimal Spicetify type declarations covering only what we use.

declare global {
  const Spicetify: SpicetifyApi;

  interface SpicetifyApi {
    Player: SpicetifyPlayer;
    Platform: SpicetifyPlatform;
    CosmosAsync: SpicetifyCosmosAsync;
    GraphQL?: SpicetifyGraphQL;
    SVGIcons?: Record<string, string>;
    Webpack?: SpicetifyWebpack;
  }

  // Minimal surface of Spicetify.Webpack. Shape varies across builds — treat
  // these as best-effort hooks into Spotify's bundled modules; always guard
  // with optional chaining and wrap predicates in try/catch (some exported
  // modules throw when read via `in`).
  interface SpicetifyWebpack {
    find?: (predicate: (m: unknown) => boolean) => unknown;
    findByProps?: (...props: string[]) => unknown;
    moduleCache?: Record<string, { exports?: unknown } | undefined>;
    chunks?: unknown[];
  }

  interface GraphQLDef {
    name: string;
    operation: string;
    sha256Hash: string;
    value: unknown;
  }

  interface SpicetifyGraphQL {
    Definitions: Record<string, GraphQLDef>;
    Request(
      operation: GraphQLDef,
      variables?: Record<string, unknown>,
    ): Promise<any>;
  }

  interface SpicetifyPlayer {
    data?: {
      item?: Track;
      position_as_of_timestamp?: number;
      timestamp?: number;
      isPaused?: boolean;
      shuffle?: boolean;
      repeat?: 0 | 1 | 2;
      duration?: { milliseconds: number };
      context?: {
        uri?: string;
        metadata?: { context_description?: string };
      };
    } | null;
    addEventListener(
      event:
        | "songchange"
        | "onplaypause"
        | "onprogress"
        | "onshuffleupdate"
        | "onrepeatupdate",
      cb: () => void,
    ): void;
    getProgress(): number;
    getDuration(): number;
    playUri(uri: string): Promise<void>;
    seek(positionMs: number): void;
    play(): void;
    pause(): void;
    togglePlay(): void;
    next(): void;
    back(): void;
    getVolume(): number;
    setVolume(v: number): void;
    getMute(): boolean;
    toggleMute(): void;
    getShuffle(): boolean;
    toggleShuffle(): void;
    getRepeat(): 0 | 1 | 2;
    setRepeat(mode: 0 | 1 | 2): void;
  }

  interface Track {
    uri: string;
    name?: string;
    duration?: { milliseconds: number };
    metadata?: TrackMetadata;
  }

  interface TrackMetadata {
    title?: string;
    artist_name?: string;
    artist_uri?: string;
    album_title?: string;
    album_uri?: string;
    duration?: string;
    image_url?: string;
    image_small_url?: string;
    image_large_url?: string;
    image_xlarge_url?: string;
    [key: string]: string | undefined;
  }

  interface SpicetifyPlatform {
    History: {
      push(path: string): void;
      listen(cb: (location: { pathname: string }) => void): () => void;
    };
  }

  interface SpicetifyCosmosAsync {
    get(
      url: string,
      body?: unknown,
      headers?: Record<string, string>,
    ): Promise<any>;
  }
}

export {};
