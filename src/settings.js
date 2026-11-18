// User settings for ani-tui, saved as JSON under the XDG config directory.
// Precedence for a session: command-line flag > ANI_CLI_* environment variable > settings file > default.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const configDir = path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"), "ani-cli");
const configFile = path.join(configDir, "ani-tui.json");

export const ACCENTS = [
  { value: "#d97757", label: "Clay" },
  { value: "#7aa2f7", label: "Blue" },
  { value: "#9ece6a", label: "Green" },
  { value: "#bb9af7", label: "Purple" },
  { value: "#e0af68", label: "Amber" },
  { value: "#f7768e", label: "Rose" },
];

/**
 * Every row in the Settings tab. type: "choice" (cycle through options), "toggle",
 * "text" (edit inline) or "action" (runs after a confirmation).
 */
export const SETTINGS = [
  {
    key: "mode",
    section: "Playback",
    label: "Audio",
    type: "choice",
    options: ["sub", "dub"],
    default: "sub",
    help: "Japanese audio with subtitles, or English dub. Press s anywhere to switch for this session only.",
  },
  {
    key: "quality",
    section: "Playback",
    label: "Quality",
    type: "choice",
    options: ["best", "1080p", "720p", "480p", "360p", "worst"],
    default: "best",
    help: "Preferred stream quality. If an episode doesn't have it, the best available is used.",
  },
  {
    key: "subtitles",
    section: "Playback",
    label: "Subtitle file",
    type: "toggle",
    default: true,
    help: "Load the separate subtitle track when an episode has one. Turn off if subtitles are burned into the video.",
  },
  {
    key: "player",
    section: "Playback",
    label: "Player",
    type: "choice",
    options: ["auto", "mpv.exe", "mpv", "vlc.exe", "vlc", "iina"],
    default: "auto",
    help: "Program that plays the video. auto uses mpv.exe on WSL, otherwise mpv or vlc.",
  },
  {
    key: "playerFlags",
    section: "Playback",
    label: "Player options",
    type: "text",
    default: "",
    placeholder: "e.g. --fullscreen --volume=70",
    help: "Extra command-line options passed to the player, separated by spaces.",
  },
  {
    key: "accent",
    section: "Appearance",
    label: "Accent color",
    type: "choice",
    options: ACCENTS.map((a) => a.value),
    labels: Object.fromEntries(ACCENTS.map((a) => [a.value, a.label])),
    default: ACCENTS[0].value,
    help: "Color for the cursor, borders and highlights.",
  },
  {
    key: "clearHistory",
    section: "Data",
    label: "Clear history",
    type: "action",
    help: "Forget every show and the last episode watched. Also clears ./ani-cli's history, since they share it.",
  },
  {
    key: "clearWatchLater",
    section: "Data",
    label: "Clear watch later",
    type: "action",
    help: "Remove every show from the watch later list.",
  },
];

export const DEFAULTS = Object.fromEntries(SETTINGS.filter((s) => s.type !== "action").map((s) => [s.key, s.default]));

export function loadSettings() {
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(configFile, "utf8"));
  } catch {}
  const out = { ...DEFAULTS };
  for (const s of SETTINGS) {
    if (!(s.key in saved)) continue;
    const v = saved[s.key];
    if (s.type === "choice" && !s.options.includes(v)) continue;
    if (s.type === "toggle" && typeof v !== "boolean") continue;
    if (s.type === "text" && typeof v !== "string") continue;
    out[s.key] = v;
  }
  return out;
}

export function saveSettings(settings) {
  fs.mkdirSync(configDir, { recursive: true });
  const tmp = `${configFile}.new`;
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2) + "\n");
  fs.renameSync(tmp, configFile);
}

/** Session overrides from ANI_CLI_* environment variables, labelled with where they came from. */
export function envOverrides() {
  const o = {};
  const env = process.env;
  if (env.ANI_CLI_MODE === "sub" || env.ANI_CLI_MODE === "dub") o.mode = { value: env.ANI_CLI_MODE, from: "ANI_CLI_MODE" };
  if (env.ANI_CLI_QUALITY) o.quality = { value: env.ANI_CLI_QUALITY, from: "ANI_CLI_QUALITY" };
  if (env.ANI_CLI_PLAYER) o.player = { value: env.ANI_CLI_PLAYER, from: "ANI_CLI_PLAYER" };
  if (env.ANI_CLI_PLAYER_FLAGS) o.playerFlags = { value: env.ANI_CLI_PLAYER_FLAGS, from: "ANI_CLI_PLAYER_FLAGS" };
  return o;
}
