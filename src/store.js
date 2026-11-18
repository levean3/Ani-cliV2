// History and watch-later storage.
// History uses the same file and format as the shell ani-cli (ep \t id \t title per line),
// so both tools see the same "continue watching" list.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const stateDir =
  process.env.ANI_CLI_HIST_DIR ??
  path.join(process.env.XDG_STATE_HOME ?? path.join(os.homedir(), ".local", "state"), "ani-cli");
const histFile = path.join(stateDir, "ani-hsts");
const laterFile = path.join(stateDir, "watch-later.json");

fs.mkdirSync(stateDir, { recursive: true });

function writeAtomic(file, data) {
  const tmp = `${file}.new`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

/** [{ episode, id, title }] in file order (oldest first). */
export function readHistory() {
  if (!fs.existsSync(histFile)) return [];
  return fs
    .readFileSync(histFile, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [episode, id, ...rest] = line.split("\t");
      return { episode, id, title: rest.join("\t") };
    })
    .filter((e) => e.id && e.id.includes("-")); // old v4 ids are not playable on this provider
}

function writeHistory(entries) {
  writeAtomic(histFile, entries.map((e) => `${e.episode}\t${e.id}\t${e.title}`).join("\n") + (entries.length ? "\n" : ""));
}

export function recordWatched(id, title, episode) {
  const entries = readHistory();
  const existing = entries.find((e) => e.id === id);
  if (existing) existing.episode = String(episode);
  else entries.push({ episode: String(episode), id, title });
  writeHistory(entries);
}

export function removeHistory(id) {
  writeHistory(readHistory().filter((e) => e.id !== id));
}

/** [{ id, title, type, sub, dub, eps, addedAt }] newest first. */
export function readWatchLater() {
  try {
    return JSON.parse(fs.readFileSync(laterFile, "utf8"));
  } catch {
    return [];
  }
}

export function isInWatchLater(id) {
  return readWatchLater().some((e) => e.id === id);
}

/** Adds the show if missing, removes it if present. Returns true if it is now in the list. */
export function toggleWatchLater(show) {
  const list = readWatchLater();
  const idx = list.findIndex((e) => e.id === show.id);
  if (idx >= 0) list.splice(idx, 1);
  else {
    const { id, title, jname, type, duration, sub, dub, eps, description } = show;
    list.unshift({ id, title, jname, type, duration, sub, dub, eps, description, addedAt: new Date().toISOString() });
  }
  writeAtomic(laterFile, JSON.stringify(list, null, 2));
  return idx < 0;
}
