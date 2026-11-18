// Smoke test for src/provider.js against the live site. Usage: npm run check -- [query]
import { search, episodes, sources, pickQuality } from "../src/provider.js";

const query = process.argv.slice(2).join(" ") || "monogatari";
const { results, hasNextPage } = await search(query);
console.log(`search "${query}": ${results.length} results, next page: ${hasNextPage}`);
console.log(results.slice(0, 3));
const show = results[0];
const eps = await episodes(show.id);
console.log(`episodes for ${show.id}: ${eps.length}`, eps.slice(0, 2));
const src = await sources(eps[0].id, "sub");
console.log("qualities:", src.links.map((l) => l.quality).join(", "));
console.log("picked:", pickQuality(src.links, "best"));
console.log("subtitle:", src.subtitle || "(none)", "referer:", src.referer, "mal:", src.malId);
