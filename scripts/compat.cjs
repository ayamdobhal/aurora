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
