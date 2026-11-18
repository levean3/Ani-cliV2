#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { readFileSync } from "node:fs";
import App from "../src/ui.js";
import { detectPlayer } from "../src/player.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const args = process.argv.slice(2);
let mode = process.env.ANI_CLI_MODE ?? "sub";
let quality = process.env.ANI_CLI_QUALITY ?? "best";
const words = [];

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "-h" || a === "--help") {
    console.log(`Usage: ani-tui [options] [query]

Options:
  --dub              Start in dub mode (toggle with s inside the app)
  -q, --quality Q    best, worst, or a height like 720p (default: best)
  -V, --version      Show the version
  -h, --help         Show this help

Environment: ANI_CLI_PLAYER, ANI_CLI_PLAYER_FLAGS, ANI_CLI_MODE, ANI_CLI_QUALITY, ANI_CLI_HIST_DIR`);
    process.exit(0);
  } else if (a === "-V" || a === "--version") {
    console.log(pkg.version);
    process.exit(0);
  } else if (a === "--dub") mode = "dub";
  else if (a === "-q" || a === "--quality") quality = args[++i] ?? quality;
  else words.push(a);
}

if (!process.stdin.isTTY) {
  console.error("ani-tui needs an interactive terminal. Use ./ani-cli for scripting.");
  process.exit(1);
}

const player = detectPlayer();

// draw on the alternate screen, like full-screen terminal apps, and restore the terminal on exit
const restore = () => process.stdout.write("\x1b[?1049l\x1b[?25h");
process.stdout.write("\x1b[?1049h\x1b[H");
process.on("exit", restore);

const app = render(
  React.createElement(App, { initialQuery: words.join(" "), initialMode: mode, quality, player }),
  { exitOnCtrlC: false },
);
await app.waitUntilExit();
