// Read-only checks against an already running desktop client. No credentials or page text captured.
const { chromium } = require("playwright");
const { buildSync } = require("esbuild");
const fs = require("node:fs");
(async () => {
  const endpoint = process.env.SPOTIFY_CDP || "http://127.0.0.1:9228";
  if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(endpoint).hostname))
    throw Error("Use a loopback CDP endpoint");
  const browser = await chromium.connectOverCDP(endpoint, { timeout: 10000 });
  try {
    const page = browser
      .contexts()
      .flatMap((c) => c.pages())
      .find((p) => p.url().startsWith("https://xpui.app.spotify.com/"));
    if (!page) throw Error("Spotify desktop page not found");
    const bundle = buildSync({
      entryPoints: ["src/lib/resolvers.ts"],
      bundle: true,
      write: false,
      format: "iife",
      globalName: "Resolvers",
    }).outputFiles[0].text;
    const report = await page.evaluate((code) => {
      const r = new Function(code + "; return Resolvers;")();
      const checks = [];
      for (const name of [
        "getMainView",
        "getRightSidebar",
        "getMiniplayerButton",
        "getFriendActivityButton",
        "getSpotifyLyricsContainer",
        "getSwitchToAudioButton",
      ]) {
        const required = ["getMainView", "getRightSidebar"].includes(name);
        checks.push({
          name,
          status: r[name]() ? "pass" : required ? "fail" : "not-observed",
          patch: "src/lib/resolvers.ts",
        });
      }
      const panel = document.querySelector("#custom-right-panel");
      if (panel) {
        const cover = panel
          .querySelector(".crp-cover")
          ?.getBoundingClientRect();
        const info = panel
          .querySelector(".crp-track-info")
          ?.getBoundingClientRect();
        checks.push({
          name: "Aurora artwork geometry",
          status:
            cover &&
            info &&
            cover.width > 40 &&
            cover.height > 40 &&
            cover.bottom <= info.top + 1
              ? "pass"
              : "fail",
          patch: "theme/user.css (.crp-player grid rows)",
        });
      }
      // Inspect live key cells independently of Spotify's generated class names.
      const keyHeader = [...document.querySelectorAll('[role="columnheader"]')].find(e => e.textContent.trim() === 'Key');
      const keyColumn = keyHeader?.getAttribute('aria-colindex');
      const cells = keyColumn ? [...document.querySelectorAll(`[role="gridcell"][aria-colindex="${keyColumn}"]`)] : [];
      const badges = [...document.querySelectorAll('.mOhp6uUOOQY4YFdW,[data-testid="bpm-key-metadata"] div[style*="background-color"]'), ...cells.flatMap(e => [...e.querySelectorAll('div[style*="background-color"]')])];
      const parse = value => {
        const n = value.match(/[\d.]+/g)?.map(Number) || [];
        return {rgb:n.slice(0,3),alpha:n[3] ?? 1};
      };
      const luminance = rgb => rgb.map(v => {v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
      const readable = badges.every(b => {
        if (!b.firstElementChild) return false;
        const ink = parse(getComputedStyle(b.firstElementChild).color), fill = parse(getComputedStyle(b).backgroundColor);
        if (ink.rgb.length!==3 || fill.rgb.length!==3 || ink.alpha<1 || fill.alpha<1) return false;
        const a=luminance(ink.rgb),z=luminance(fill.rgb);
        return (Math.max(a,z)+.05)/(Math.min(a,z)+.05)>=4.5;
      });
      checks.push({name:'Mix key badge structure and contrast',status:badges.length?(readable?'pass':'fail'):cells.some(e=>e.textContent.trim())?'fail':'not-observed',patch:'theme/user.css (Mix key badge foreground; open a populated Mix view)'});
      const sp = globalThis.Spicetify;
      if (!sp)
        checks.push({
          name: "Spicetify installation",
          status: "blocked",
          patch:
            "Apply Spicetify and restart Spotify before judging compatibility",
        });
      for (const path of [
        "Player.addEventListener",
        "Player.togglePlay",
        "Player.seek",
        "Player.getProgress",
        "Player.getDuration",
        "Platform.History.push",
        "CosmosAsync.get",
      ]) {
        const value = path.split(".").reduce((v, k) => v?.[k], sp);
        checks.push({
          name: path,
          status: !sp
            ? "blocked"
            : typeof value === "function"
              ? "pass"
              : "fail",
          patch: "src/spicetify.d.ts and consuming extension",
        });
      }
      return { spicetify: sp?.Config?.version || null, checks };
    }, bundle);
    report.timestamp = new Date().toISOString();
    report.clientVersion = await browser.version();
    fs.mkdirSync("reports", { recursive: true });
    fs.writeFileSync(
      "reports/compat-latest.json",
      JSON.stringify(report, null, 2),
    );
    for (const c of report.checks)
      console.log(`${c.status.padEnd(12)} ${c.name} (${c.patch})`);
    console.log("Report: reports/compat-latest.json");
    process.exitCode = report.checks.some((c) => c.status === "blocked")
      ? 2
      : report.checks.some((c) => c.status === "fail")
        ? 1
        : 0;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error("Compatibility check could not run:", error.message);
  process.exitCode = 2;
});
