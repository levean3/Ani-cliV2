// Launch the video player, mirroring the player selection in ../ani-cli.
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";

const found = new Map();
export function isInstalled(cmd) {
  if (!found.has(cmd)) {
    found.set(cmd, spawnSync("sh", ["-c", 'command -v "$1"', "sh", cmd], { stdio: "ignore" }).status === 0);
  }
  return found.get(cmd);
}

/** Resolve a player setting ("auto" or a command name) to the command to run, or null. */
export function resolvePlayer(setting = "auto") {
  if (setting && setting !== "auto") return setting;
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
  const child = spawn(player, args, { detached: true, stdio: "ignore" });
  child.on("error", () => {}); // reported through the returned promise instead
  child.unref();
  return new Promise((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", (err) => reject(new Error(`Could not start ${player}: ${err.message}`)));
  });
}
