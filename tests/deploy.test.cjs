const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
for (const manifest of [false, true])
  test(`deployment preserves unrelated extensions (${manifest ? "existing manifest" : "first upgrade"})`, (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aurora-deploy-test-"));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    for (const sub of [
      "scripts",
      "theme",
      "extensions",
      "bin",
      "config/Themes/aurora",
    ])
      fs.mkdirSync(path.join(dir, sub), { recursive: true });
    // Keep even the legacy hardcoded default inside the fixture when this
    // regression test is run against an older version of the script.
    fs.writeFileSync(
      path.join(dir, "scripts/deploy.sh"),
      fs.readFileSync("scripts/deploy.sh", "utf8").replaceAll(
        "$HOME/.config/spicetify", path.join(dir, "config"),
      ),
    );
    fs.writeFileSync(path.join(dir, "extensions/current.js"), "// bundle");
    fs.writeFileSync(path.join(dir, "theme/user.css"), "body {}");
    fs.writeFileSync(
      path.join(dir, "config/config-xpui.ini"),
      "extensions = unrelated.js|old-aurora.js\n",
    );
    if (manifest)
      fs.writeFileSync(
        path.join(dir, "config/Themes/aurora/.aurora-extensions"),
        "old-aurora.js\ncurrent.js\n",
      );
    fs.writeFileSync(
      path.join(dir, "bin/spicetify"),
      '#!/bin/bash\nprintf "%s\\n" "$*" >> "$AURORA_TEST_LOG"\n',
      { mode: 0o755 },
    );
    const log = path.join(dir, "calls");
    const result = spawnSync("bash", [path.join(dir, "scripts/deploy.sh")], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: path.join(dir, "bin") + path.delimiter + process.env.PATH,
        SPICETIFY_DIR: path.join(dir, "config"),
        AURORA_TEST_LOG: log,
      },
    });
    assert.equal(result.status, 0, result.stderr);
    const calls = fs.readFileSync(log, "utf8");
    assert.doesNotMatch(calls, /unrelated.js-/);
    assert.equal(calls.includes("old-aurora.js-"), manifest);
    assert.match(calls, /config extensions current.js/);
    assert.equal(
      fs.readFileSync(
        path.join(dir, "config/Themes/aurora/.aurora-extensions"),
        "utf8",
      ),
      "current.js\n",
    );
  });
