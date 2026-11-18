#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { readFileSync } from "node:fs";
import App from "../src/ui.js";
import { envOverrides } from "../src/settings.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const args = process.argv.slice(2);
// session-only overrides: flags beat environment variables, both beat the settings file
const overrides = envOverrides();
const words = [];

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "-h" || a === "--help") {
    console.log(`Usage: ani-tui [options] [query]

Options:
  --dub              Use dub for this session
  -q, --quality Q    best, worst, or a height like 720p, for this session
  -V, --version      Show the version
  -h, --help         Show this help

Defaults are set in the Settings tab. These environment variables override them
for a session: ANI_CLI_MODE, ANI_CLI_QUALITY, ANI_CLI_PLAYER, ANI_CLI_PLAYER_FLAGS.
ANI_CLI_HIST_DIR moves the history and watch later files.`);
    process.exit(0);
  } else if (a === "-V" || a === "--version") {
    console.log(pkg.version);
    process.exit(0);
  } else if (a === "--dub") overrides.mode = { value: "dub", from: "--dub" };
  else if (a === "-q" || a === "--quality") {
    if (!args[i + 1]) {
      console.error(`${a} needs a value, e.g. ${a} 720p`);
      process.exit(1);
    }
    overrides.quality = { value: args[++i], from: a };
  } else words.push(a);
}

if (!process.stdin.isTTY) {
  console.error("ani-tui needs an interactive terminal. Use ./ani-cli for scripting.");
  process.exit(1);
}

// draw on the alternate screen, like full-screen terminal apps, and restore the terminal on exit
const restore = () => process.stdout.write("\x1b[?1049l\x1b[?25h");
process.stdout.write("\x1b[?1049h\x1b[H");
process.on("exit", restore);

const app = render(React.createElement(App, { initialQuery: words.join(" "), overrides }), { exitOnCtrlC: false });
await app.waitUntilExit();
