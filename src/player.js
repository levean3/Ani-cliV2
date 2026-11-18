// Launch the video player, mirroring the player selection in ../ani-cli.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const isWindows = process.platform === "win32";

// VLC's installer doesn't add it to PATH on Windows, so also look in the usual install folders
const WINDOWS_VLC = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]]
  .filter(Boolean)
  .map((dir) => path.join(dir, "VideoLAN", "VLC", "vlc.exe"));

const found = new Map();
/** True if `cmd` is an existing file path or a command on PATH. */
export function isInstalled(cmd) {
  if (!found.has(cmd)) {
    let ok;
    if (path.isAbsolute(cmd)) ok = fs.existsSync(cmd);
    else if (isWindows) ok = spawnSync("where", [cmd], { stdio: "ignore", windowsHide: true }).status === 0;
    else ok = spawnSync("sh", ["-c", 'command -v "$1"', "sh", cmd], { stdio: "ignore" }).status === 0;
    found.set(cmd, ok);
  }
  return found.get(cmd);
}

/** Resolve a player setting ("auto" or a command name) to the command to run, or null. */
export function resolvePlayer(setting = "auto") {
  if (setting && setting !== "auto") {
    // on Windows "vlc" usually isn't on PATH; fall back to the installed copy
    if (isWindows && /^vlc(\.exe)?$/.test(setting) && !isInstalled(setting)) {
      return WINDOWS_VLC.find(isInstalled) ?? setting;
    }
    return setting;
  }
  if (isWindows) {
    // name the .exe explicitly: a bare "mpv" can start mpv.com, the console wrapper, instead
    if (isInstalled("mpv.exe")) return "mpv.exe";
    if (isInstalled("vlc.exe")) return "vlc.exe";
    return WINDOWS_VLC.find(isInstalled) ?? null;
  }
  if (/WSL2|microsoft/i.test(os.release()) && isInstalled("mpv.exe")) return "mpv.exe"; // Windows mpv from WSL
  if (process.platform === "darwin" && isInstalled("iina")) return "iina";
  for (const p of ["mpv", "vlc"]) if (isInstalled(p)) return p;
  return null;
}

/**
 * Start playback detached from the TUI.
 * @param {string} player command to run
 * @param {{ url: string, referer: string, subtitle?: string, title: string }} media
 * @param {string} flags extra player options, space separated
 */
export function play(player, media, flags = "") {
  if (!player) throw new Error("No player found. Install mpv, or choose one in Settings.");
  const extra = flags.split(" ").filter(Boolean);
  let args;
  if (/mpv/.test(player)) {
    args = [
      `--referrer=${media.referer}`,
      ...(media.subtitle ? [`--sub-file=${media.subtitle}`] : []),
      `--force-media-title=${media.title}`,
      ...extra,
      media.url,
    ];
  } else if (/vlc/.test(player)) {
    args = [
      `--http-referrer=${media.referer}`,
      "--play-and-exit",
      `--meta-title=${media.title}`,
      ...extra,
      media.url,
      ...(media.subtitle ? [`:input-slave=${media.subtitle}`] : []),
    ];
  } else if (/iina/.test(player)) {
    const sub = media.subtitle?.replace(/:/g, "\\:"); // mpv splits sub-files on ':'
    args = [
      `--mpv-referrer=${media.referer}`,
      ...(sub ? [`--mpv-sub-files=${sub}`] : []),
      "--no-stdin",
      `--mpv-force-media-title=${media.title}`,
      ...extra,
      media.url,
    ];
  } else {
    args = [...extra, media.url];
  }
  // windowsHide stops Windows from opening an empty console window next to the player
  const child = spawn(player, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.on("error", () => {}); // reported through the returned promise instead
  child.unref();
  return new Promise((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", (err) => reject(new Error(`Could not start ${player}: ${err.message}`)));
  });
}
