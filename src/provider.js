// Scraper for hianime.at, ported from the shell functions in ../ani-cli
// (hianime_search, hianime_episodes, hianime_m3u8, deobfuscate_blob).

// hianime.at redirects to the site's current domain; once a redirect is seen, requests go
// straight to the new domain so each one costs a single connection instead of two.
let BASE = process.env.ANI_CLI_BASE ?? "https://hianime.at";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const TIMEOUT_MS = 20000;

async function get(url, { referer, signal } = {}) {
  const headers = { "user-agent": UA };
  if (referer) headers.referer = referer;
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, { headers, signal: signal ? AbortSignal.any([signal, timeout]) : timeout, redirect: "follow" });
  } catch (err) {
    if (signal?.aborted) throw err;
    if (timeout.aborted) throw new Error(`Timed out fetching ${new URL(url).host}. Check your connection.`);
    throw new Error(`Connection error: could not fetch ${url} (${err.cause?.code ?? err.message})`);
  }
  if (url.startsWith(BASE) && res.redirected) BASE = new URL(res.url).origin;
  const text = await res.text();
  if (/<title>Just a moment/i.test(text)) throw new Error("Blocked by Cloudflare.");
  if (!res.ok) throw new Error(`Request failed: HTTP ${res.status} from ${url}`);
  return text;
}

const decodeEntities = (s) =>
  s
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const clean = (s) => decodeEntities((s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim());

// The site answers some API calls with {status, html}; fall back to raw text.
function htmlOf(text) {
  try {
    const j = JSON.parse(text);
    if (j && typeof j.html === "string") return j.html;
  } catch {}
  return text.replace(/\\/g, "");
}

/**
 * Search for anime. Returns { results, hasNextPage }.
 * Each result: { id, title, jname, description, type, duration, sub, dub, eps, poster }
 */
export async function search(query, { page = 1, signal } = {}) {
  const url = `${BASE}/search?keyword=${encodeURIComponent(query.trim())}${page > 1 ? `&page=${page}` : ""}`;
  const html = await get(url, { signal });
  // the top-10 sidebar repeats the result markup; cut it off first
  const main = html.split('id="main-sidebar"')[0];
  const results = [];
  for (const block of main.split('<div class="flw-item').slice(1)) {
    const link = block.match(/<h3 class="film-name">\s*<a href="[^"]*\/([^"/]*)"\s*title="([^"]*)"(?:[^>]*data-jname="([^"]*)")?/);
    if (!link) continue;
    const tick = (cls) => {
      const m = block.match(new RegExp(`tick-${cls}"[^>]*>(?:<i[^>]*></i>)?\\s*([0-9]+)`));
      return m ? Number(m[1]) : 0;
    };
    const fdi = [...block.matchAll(/<span class="fdi-item[^"]*">([^<]*)<\/span>/g)].map((m) => clean(m[1]));
    results.push({
      id: link[1],
      title: decodeEntities(link[2]),
      jname: link[3] ? decodeEntities(link[3]) : "",
      description: clean(block.match(/<div class="description">([\s\S]*?)<\/div>/)?.[1]),
      type: fdi[0] ?? "",
      duration: clean(block.match(/fdi-duration">([^<]*)</)?.[1]) || fdi[1] || "",
      sub: tick("sub"),
      dub: tick("dub"),
      eps: tick("eps"),
      poster: block.match(/<img[^>]*src="([^"]*)"/)?.[1] ?? "",
    });
  }
  const hasNextPage = new RegExp(`page=${page + 1}\\b`).test(main);
  return { results, hasNextPage };
}

/**
 * Episode list for an anime id (slug like "bakemonogatari-1234").
 * Returns [{ id, number, title, jname }]. Empty if the id no longer matches the site
 * (ids from the v5.0 provider have the same shape, so the slug is checked too).
 */
export async function episodes(animeId, { signal } = {}) {
  const numeric = animeId.split("-").pop();
  const html = htmlOf(await get(`${BASE}/api/theme/episode/list/${numeric}`, { signal }));
  const out = [];
  for (const item of html.split("ep-item").slice(1)) {
    const num = item.match(/data-number="([^"]*)"/)?.[1];
    const id = item.match(/data-id="([0-9]+)"/)?.[1];
    const href = item.match(/href="[^"]*\/watch\/([^"?]*)\?ep=/)?.[1];
    if (!num || !id || href !== animeId) continue;
    const nameTag = item.match(/<div class="ep-name[^>]*>/)?.[0] ?? "";
    const attr = (a) => decodeEntities(nameTag.match(new RegExp(`${a}="([^"]*)"`))?.[1] ?? "");
    out.push({ id, number: num, title: attr("title"), jname: attr("data-jname") });
  }
  return out;
}

// the embed page ships its config as base64(json XOR "otaku-embed-v1")
function deobfuscate(blob) {
  const key = Buffer.from("otaku-embed-v1");
  const bytes = Buffer.from(blob, "base64");
  for (let i = 0; i < bytes.length; i++) bytes[i] ^= key[i % key.length];
  return bytes.toString("utf8");
}

/**
 * Resolve playable streams for an episode id in mode "sub" | "dub".
 * Returns { links: [{ quality, url }] (best first), subtitle, referer, malId }.
 */
export async function sources(episodeId, mode = "sub", { signal } = {}) {
  const html = htmlOf(await get(`${BASE}/api/theme/episode/servers?episodeId=${episodeId}`, { signal }));
  // only the ZokoAnime embed is understood by deobfuscate(), the other servers use different players
  const server = html
    .split("server-item")
    .find((s) => s.includes(`data-type="${mode}"`) && s.includes('data-server-name="ZokoAnime"'));
  const hash = server?.match(/data-hash="([^"]*)"/)?.[1];
  if (!hash) throw new Error(`No ${mode} sources found for this episode.`);
  const embed = Buffer.from(hash, "base64").toString("utf8");
  const referer = embed.replace(/^(https?:\/\/[^/]*).*/, "$1/");
  const malId = embed.match(/\/mal\/([0-9]+)\//)?.[1] ?? "";

  const page = await get(embed, { signal });
  const blob = page.match(/window\.__P="([^"]*)"/)?.[1];
  if (!blob) throw new Error("Could not read the video player config.");
  const config = JSON.parse(deobfuscate(blob));
  const master = findM3u8(config);
  if (!master) throw new Error("No stream found in the player config.");
  const subtitle = (config.subtitles ?? config.tracks ?? []).find((t) => t.default)?.src ?? "";

  const playlist = await get(master, { referer, signal });
  const lines = playlist.split(/\r?\n/);
  const links = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("#EXT-X-STREAM-INF")) continue;
    const height = lines[i].match(/RESOLUTION=\d+x(\d+)/)?.[1];
    const uri = lines[i + 1]?.trim();
    if (!uri || uri.startsWith("#")) continue;
    links.push({ quality: height ? `${height}p` : "auto", url: new URL(uri, master).href });
  }
  links.sort((a, b) => parseInt(b.quality) - parseInt(a.quality) || 0);
  if (!links.length) links.push({ quality: "auto", url: master });
  return { links, subtitle, referer, malId };
}

function findM3u8(obj) {
  if (typeof obj === "string") return /\.m3u8/.test(obj) ? obj : null;
  if (obj && typeof obj === "object") {
    if (typeof obj.src === "string" && /\.m3u8/.test(obj.src)) return obj.src;
    for (const v of Object.values(obj)) {
      const found = findM3u8(v);
      if (found) return found;
    }
  }
  return null;
}

/** Pick a link for a quality setting: "best", "worst", or e.g. "720p". */
export function pickQuality(links, wanted = "best") {
  if (!links.length) return null;
  if (wanted === "best") return links[0];
  if (wanted === "worst") return links[links.length - 1];
  return links.find((l) => l.quality.includes(wanted)) ?? links[0];
}
