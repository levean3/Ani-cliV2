// Launch the video player, mirroring the player selection in ../ani-cli.
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";

const has = (cmd) => spawnSync("sh", ["-c", `command -v "${cmd}"`], { stdio: "ignore" }).status === 0;

export function detectPlayer() {
  if (process.env.ANI_CLI_PLAYER) return process.env.ANI_CLI_PLAYER;
  const release = os.release();
  if (/WSL2|microsoft/i.test(release) && has("mpv.exe")) return "mpv.exe"; // Windows mpv from WSL
  if (process.platform === "darwin" && has("iina")) return "iina";
  for (const p of ["mpv", "vlc"]) if (has(p)) return p;
  return null;
}

/**
 * Start playback detached from the TUI.
 * @param {{ url: string, referer: string, subtitle?: string, title: string }} media
 */
export function play(player, media) {
  if (!player) throw new Error("No player found. Install mpv, or set ANI_CLI_PLAYER.");
  const extra = (process.env.ANI_CLI_PLAYER_FLAGS ?? "").split(" ").filter(Boolean);
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
    args = [`--http-referrer=${media.referer}`, "--play-and-exit", `--meta-title=${media.title}`, ...extra, media.url];
  } else if (/iina/.test(player)) {
    args = [`--mpv-referrer=${media.referer}`, "--no-stdin", `--mpv-force-media-title=${media.title}`, ...extra, media.url];
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
