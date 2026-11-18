// Interactive terminal UI. Written with htm instead of JSX so it runs without a build step.
import React, { useEffect, useRef, useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import htm from "htm";
import { search, episodes as fetchEpisodes, sources, pickQuality } from "./provider.js";
import { readHistory, recordWatched, removeHistory, readWatchLater, toggleWatchLater, isInWatchLater } from "./store.js";
import { play } from "./player.js";

const html = htm.bind(React.createElement);
const ACCENT = "#d97757";
const TABS = [
  { key: "search", label: "Search" },
  { key: "history", label: "History" },
  { key: "later", label: "Watch later" },
];

// ---------- small building blocks ----------

function useTerminalSize() {
  const { stdout } = useStdout();
  const [size, setSize] = useState({ cols: stdout.columns || 80, rows: stdout.rows || 24 });
  useEffect(() => {
    const onResize = () => setSize({ cols: stdout.columns, rows: stdout.rows });
    stdout.on("resize", onResize);
    return () => stdout.off("resize", onResize);
  }, [stdout]);
  return size;
}

/** Vertical list that scrolls to keep the selected row visible. */
function List({ items, selected, height, render, active = true, empty }) {
  if (!items.length) return html`<${Box} height=${height} width="100%"><${Text} dimColor>${empty}<//><//>`;
  const h = Math.max(1, height);
  let start = Math.min(Math.max(0, selected - Math.floor(h / 2)), Math.max(0, items.length - h));
  const visible = items.slice(start, start + h);
  return html`
    <${Box} flexDirection="column" height=${h} width="100%">
      ${visible.map((item, i) => {
        const idx = start + i;
        const isSel = idx === selected;
        return html`
          <${Box} key=${idx}>
            <${Text} color=${ACCENT}>${isSel && active ? "❯ " : "  "}<//>
            <${Box} flexGrow=${1}>${render(item, isSel && active, idx)}<//>
          <//>`;
      })}
    <//>`;
}

function Header({ tab, mode, inSubview }) {
  return html`
    <${Box} paddingX=${1} justifyContent="space-between">
      <${Box} gap=${2}>
        <${Text} bold color=${ACCENT}>✻ ani-cli v2<//>
        ${TABS.map(
          (t) => html`<${Text} key=${t.key} bold=${t.key === tab} color=${t.key === tab && !inSubview ? ACCENT : undefined}
            dimColor=${t.key !== tab}>${t.key === tab ? `[${t.label}]` : t.label}<//>`,
        )}
      <//>
      <${Text} bold color=${mode === "dub" ? "cyan" : "yellow"}>${mode.toUpperCase()}<//>
    <//>`;
}

function Footer({ hints, message }) {
  return html`
    <${Box} paddingX=${1} justifyContent="space-between">
      <${Text} dimColor>${hints.join("  ·  ")}<//>
      ${message ? html`<${Text} color=${message.error ? "red" : "green"}>${message.text}<//>` : null}
    <//>`;
}

function Details({ show, history, width }) {
  if (!show) return null;
  const watched = history.find((h) => h.id === show.id);
  const later = isInWatchLater(show.id);
  const facts = [show.type, show.duration].filter(Boolean).join(" · ");
  return html`
    <${Box} flexDirection="column" borderStyle="round" borderColor="gray" paddingX=${1} width=${width} alignSelf="flex-start" flexShrink=${0}>
      <${Text} bold wrap="wrap">${show.title}<//>
      ${show.jname && show.jname !== show.title ? html`<${Text} dimColor wrap="wrap">${show.jname}<//>` : null}
      <${Text}> <//>
      ${facts ? html`<${Text}>${facts}<//>` : null}
      <${Box} gap=${2}>
        ${show.sub ? html`<${Text} color="yellow">SUB ${show.sub}<//>` : null}
        ${show.dub ? html`<${Text} color="cyan">DUB ${show.dub}<//>` : null}
        ${show.eps ? html`<${Text} dimColor>EPS ${show.eps}<//>` : null}
      <//>
      ${watched ? html`<${Text} color="green">Watched up to episode ${watched.episode}<//>` : null}
      ${later ? html`<${Text} color=${ACCENT}>★ In watch later<//>` : null}
      ${show.description ? html`<${Text}> <//>` : null}
      ${show.description ? html`<${Text} wrap="wrap">${show.description}<//>` : null}
    <//>`;
}

// ---------- main app ----------

export default function App({ initialQuery = "", initialMode = "sub", quality: initialQuality = "best", player }) {
  const { exit } = useApp();
  const { cols, rows } = useTerminalSize();

  const [tab, setTab] = useState("search");
  const [mode, setMode] = useState(initialMode);
  const [message, setMessage] = useState(null);
  const [history, setHistory] = useState(() => readHistory().reverse());
  const [later, setLater] = useState(() => readWatchLater());
  const [listSel, setListSel] = useState({ history: 0, later: 0 });
  const [confirmDelete, setConfirmDelete] = useState(null);

  // search state lives here so it survives opening a show and coming back
  const [query, setQuery] = useState(initialQuery);
  const [typing, setTyping] = useState(true);
  const [results, setResults] = useState([]);
  const [resultSel, setResultSel] = useState(0);
  const [page, setPage] = useState({ n: 1, hasNext: false, loadingMore: false });
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // view stack on top of the tabs: null | { name: "episodes", ... } | { name: "playing", ... }
  const [view, setView] = useState(null);
  const [now, setNow] = useState(null);
  const playToken = useRef(0);
  const digitBuffer = useRef({ text: "", timer: null });

  const flash = (text, error = false) => {
    setMessage({ text, error });
    setTimeout(() => setMessage((m) => (m?.text === text ? null : m)), 3000);
  };
  const refreshLists = () => {
    setHistory(readHistory().reverse());
    setLater(readWatchLater());
  };

  // live search, debounced; a newer query aborts the older request
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const r = await search(q, { signal: ctrl.signal });
        setResults(r.results);
        setResultSel(0);
        setPage({ n: 1, hasNext: r.hasNextPage, loadingMore: false });
        setSearchError(null);
      } catch (err) {
        if (err.name !== "AbortError") setSearchError(err.message);
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  async function loadMoreResults() {
    if (!page.hasNext || page.loadingMore) return;
    setPage((p) => ({ ...p, loadingMore: true }));
    try {
      const r = await search(query, { page: page.n + 1 });
      setResults((prev) => [...prev, ...r.results.filter((x) => !prev.some((p) => p.id === x.id))]);
      setPage({ n: page.n + 1, hasNext: r.hasNextPage, loadingMore: false });
    } catch (err) {
      setPage((p) => ({ ...p, loadingMore: false }));
      flash(err.message, true);
    }
  }

  async function openShow(show) {
    const watched = readHistory().find((h) => h.id === show.id);
    setView({ name: "episodes", show, eps: null, sel: 0, loading: true, error: null, watched: watched?.episode });
    try {
      const eps = await fetchEpisodes(show.id);
      if (!eps.length) throw new Error("No episodes found. The show may have moved on the site; search for it again.");
      // start on the episode after the last one watched
      let sel = 0;
      if (watched) {
        const i = eps.findIndex((e) => e.number === watched.episode);
        if (i >= 0) sel = Math.min(i + 1, eps.length - 1);
      }
      setView((v) => v && v.show.id === show.id && { ...v, eps, sel, loading: false });
    } catch (err) {
      setView((v) => v && v.show.id === show.id && { ...v, loading: false, error: err.message });
    }
  }

  async function startEpisode(show, eps, index, q) {
    const token = ++playToken.current;
    const ep = eps[index];
    const wantQuality = q ?? now?.quality ?? initialQuality;
    setNow({ show, eps, index, quality: wantQuality, loading: true, error: null, src: null, link: null, picking: false });
    setView({ name: "playing" });
    try {
      const src = await sources(ep.id, mode);
      if (token !== playToken.current) return;
      const link = pickQuality(src.links, wantQuality);
      await play(player, {
        url: link.url,
        referer: src.referer,
        subtitle: src.subtitle,
        title: `${show.title} Episode ${ep.number}`,
      });
      recordWatched(show.id, show.title, ep.number);
      refreshLists();
      setNow((n) => n && { ...n, loading: false, src, link });
    } catch (err) {
      if (token !== playToken.current) return;
      setNow((n) => n && { ...n, loading: false, error: err.message });
    }
  }

  function toggleLater(show) {
    const added = toggleWatchLater(show);
    refreshLists();
    flash(added ? `Added "${show.title}" to watch later` : `Removed "${show.title}" from watch later`);
  }

  function back() {
    if (view?.name === "playing") {
      if (now) openShowAt(now.show, now.eps, now.index);
      else setView(null);
    } else setView(null);
  }

  // return to the episode list without refetching it
  function openShowAt(show, eps, sel) {
    const watched = readHistory().find((h) => h.id === show.id);
    setView({ name: "episodes", show, eps, sel, loading: false, error: null, watched: watched?.episode });
  }

  const cycleTab = (dir) => {
    const i = TABS.findIndex((t) => t.key === tab);
    setTab(TABS[(i + dir + TABS.length) % TABS.length].key);
    setConfirmDelete(null);
  };

  const move = (sel, delta, len) => Math.max(0, Math.min(len - 1, sel + delta));

  useInput((input, key) => {
    if (key.ctrl && input === "c") return exit();

    // ----- playing screen -----
    if (view?.name === "playing" && now) {
      if (now.picking) {
        const links = now.src?.links ?? [];
        if (key.upArrow) setNow({ ...now, pickSel: move(now.pickSel, -1, links.length) });
        else if (key.downArrow) setNow({ ...now, pickSel: move(now.pickSel, 1, links.length) });
        else if (key.return) startEpisode(now.show, now.eps, now.index, links[now.pickSel].quality);
        else if (key.escape) setNow({ ...now, picking: false });
        return;
      }
      if (key.escape || input === "e") return back();
      if (input === "n") {
        if (now.index + 1 < now.eps.length) startEpisode(now.show, now.eps, now.index + 1);
        else flash("That was the last episode", true);
      } else if (input === "p") {
        if (now.index > 0) startEpisode(now.show, now.eps, now.index - 1);
        else flash("This is the first episode", true);
      } else if (input === "r") startEpisode(now.show, now.eps, now.index);
      else if (input === "q" && now.src?.links.length) {
        const pickSel = Math.max(0, now.src.links.findIndex((l) => l.url === now.link?.url));
        setNow({ ...now, picking: true, pickSel });
      } else if (input === "w") toggleLater(now.show);
      return;
    }

    // ----- episode list -----
    if (view?.name === "episodes") {
      const eps = view.eps ?? [];
      if (key.escape) return back();
      if (!eps.length) return;
      const page = Math.max(1, rows - 12);
      if (key.upArrow) setView({ ...view, sel: move(view.sel, -1, eps.length) });
      else if (key.downArrow) setView({ ...view, sel: move(view.sel, 1, eps.length) });
      else if (key.pageUp) setView({ ...view, sel: move(view.sel, -page, eps.length) });
      else if (key.pageDown) setView({ ...view, sel: move(view.sel, page, eps.length) });
      else if (input === "g") setView({ ...view, sel: 0 });
      else if (input === "G") setView({ ...view, sel: eps.length - 1 });
      else if (key.return) startEpisode(view.show, eps, view.sel);
      else if (input === "w") toggleLater(view.show);
      else if (input === "s") setMode((m) => (m === "sub" ? "dub" : "sub"));
      else if (/^[0-9.]+$/.test(input)) {
        // type an episode number to jump to it
        const buf = digitBuffer.current;
        clearTimeout(buf.timer);
        buf.text += input;
        const i = eps.findIndex((e) => e.number === buf.text);
        const j = i >= 0 ? i : eps.findIndex((e) => e.number.startsWith(buf.text));
        if (j >= 0) setView({ ...view, sel: j });
        buf.timer = setTimeout(() => (buf.text = ""), 800);
      }
      return;
    }

    // ----- tabs -----
    if (key.tab) return cycleTab(key.shift ? -1 : 1);

    if (tab === "search") {
      if (typing) {
        if (key.downArrow && results.length) setTyping(false);
        else if (key.return && results.length) openShow(results[resultSel]);
        else if (key.escape && query) setQuery("");
        return; // everything else goes to the text input
      }
      if (key.upArrow) {
        if (resultSel === 0) setTyping(true);
        else setResultSel(resultSel - 1);
      } else if (key.downArrow) {
        const next = move(resultSel, 1, results.length);
        setResultSel(next);
        if (next >= results.length - 3) loadMoreResults();
      } else if (key.return) openShow(results[resultSel]);
      else if (input === "/" || key.escape) setTyping(true);
      else if (input === "w") toggleLater(results[resultSel]);
      else if (input === "s") setMode((m) => (m === "sub" ? "dub" : "sub"));
      else if (input === "q") exit();
      return;
    }

    const list = tab === "history" ? history : later;
    const sel = listSel[tab];
    const setSel = (v) => setListSel((s) => ({ ...s, [tab]: v }));
    if (input === "q" || key.escape) return exit();
    if (input === "s") return setMode((m) => (m === "sub" ? "dub" : "sub"));
    if (!list.length) return;
    if (key.upArrow) setSel(move(sel, -1, list.length));
    else if (key.downArrow) setSel(move(sel, 1, list.length));
    else if (key.return) openShow(list[sel]);
    else if (input === "w" && tab === "history") toggleLater(list[sel]);
    else if (input === "d") {
      const item = list[sel];
      if (confirmDelete !== item.id) {
        setConfirmDelete(item.id);
        flash(`Press d again to remove "${item.title}"`, true);
        return;
      }
      if (tab === "history") removeHistory(item.id);
      else toggleWatchLater(item);
      setConfirmDelete(null);
      refreshLists();
      setSel(Math.max(0, Math.min(sel, list.length - 2)));
      flash(`Removed "${item.title}"`);
    }
  });

  // ---------- layout ----------
  const bodyHeight = Math.max(5, rows - 4); // header, footer, margins
  const wide = cols >= 90;
  const detailsWidth = wide ? Math.min(52, Math.floor(cols * 0.42)) : undefined;

  let body;
  let hints;

  if (view?.name === "playing" && now) {
    const ep = now.eps[now.index];
    hints = now.picking
      ? ["↑↓ choose", "enter play", "esc cancel"]
      : ["n next", "p previous", "r replay", "q quality", "w watch later", "esc episodes", "ctrl+c quit"];
    body = html`
      <${Box} flexDirection="column" paddingX=${1} height=${bodyHeight} width="100%">
        <${Box} borderStyle="round" borderColor=${ACCENT} paddingX=${1} flexDirection="column">
          <${Text} bold>${now.show.title}<//>
          <${Text}>
            Episode ${ep.number} of ${now.eps[now.eps.length - 1].number}${ep.title ? html`<${Text} dimColor> · ${ep.title}<//>` : null}
          <//>
          <${Text}> <//>
          ${now.loading
            ? html`<${Text} color=${ACCENT}><${Spinner} type="dots" /> Fetching ${mode} stream…<//>`
            : now.error
              ? html`<${Text} color="red">✗ ${now.error}<//>`
              : html`<${Text} color="green">▶ Playing in ${player} · ${mode} · ${now.link?.quality}${now.src?.subtitle ? " · subtitles" : ""}<//>`}
        <//>
        ${now.picking
          ? html`
              <${Box} flexDirection="column" marginTop=${1}>
                <${Text} bold>Quality<//>
                <${List} items=${now.src.links} selected=${now.pickSel} height=${now.src.links.length}
                  render=${(l, sel) => html`<${Text} bold=${sel}>${l.quality}${l.url === now.link?.url ? html`<${Text} dimColor> (current)<//>` : null}<//>`} />
              <//>`
          : null}
      <//>`;
  } else if (view?.name === "episodes") {
    const eps = view.eps ?? [];
    const watchedIdx = view.watched ? eps.findIndex((e) => e.number === view.watched) : -1;
    hints = ["↑↓ move", "type a number to jump", "enter play", "w watch later", "s sub/dub", "esc back"];
    body = html`
      <${Box} flexDirection="column" paddingX=${1} height=${bodyHeight} width="100%">
        <${Box} justifyContent="space-between">
          <${Text} bold color=${ACCENT}>${view.show.title}<//>
          ${eps.length ? html`<${Text} dimColor>${view.sel + 1}/${eps.length}<//>` : null}
        <//>
        <${Box} marginTop=${1} flexGrow=${1}>
          ${view.loading
            ? html`<${Text} color=${ACCENT}><${Spinner} type="dots" /> Loading episodes…<//>`
            : view.error
              ? html`<${Text} color="red">✗ ${view.error}<//>`
              : html`<${List} items=${eps} selected=${view.sel} height=${bodyHeight - 2}
                  render=${(e, sel, i) => html`
                    <${Text} wrap="truncate-end" bold=${sel}>
                      <${Text} color=${i <= watchedIdx ? "green" : undefined} dimColor=${i <= watchedIdx && !sel}>
                        ${i <= watchedIdx ? "✓" : " "} ${e.number.padStart(4)}<//>
                      ${e.title ? `  ${e.title}` : ""}
                    <//>`} />`}
        <//>
      <//>`;
  } else if (tab === "search") {
    const show = results[resultSel];
    hints = typing
      ? ["type to search", "↓ results", "enter open", "tab switch tab", "ctrl+c quit"]
      : ["↑↓ move", "enter open", "w watch later", "s sub/dub", "/ edit search", "tab switch tab", "q quit"];
    const listHeight = bodyHeight - 4;
    body = html`
      <${Box} flexDirection="column" paddingX=${1} height=${bodyHeight} width="100%">
        <${Box} borderStyle="round" borderColor=${typing ? ACCENT : "gray"} paddingX=${1} width="100%">
          <${Text} color=${ACCENT}>${"> "}<//>
          <${TextInput} value=${query} onChange=${setQuery} focus=${typing} placeholder="Search anime…" showCursor=${typing} />
          <${Box} flexGrow=${1} />
          ${searching ? html`<${Text} color=${ACCENT}><${Spinner} type="dots" /><//>` : null}
        <//>
        <${Box} flexGrow=${1} gap=${1} width="100%">
          <${Box} flexDirection="column" flexGrow=${1} flexBasis=${0}>
            ${searchError
              ? html`<${Text} color="red">✗ ${searchError}<//>`
              : html`<${List} items=${results} selected=${resultSel} height=${listHeight}
                  empty=${query.trim().length < 2 ? "Start typing to search." : searching ? "Searching…" : "No results."}
                  render=${(r, sel) => html`
                    <${Text} wrap="truncate-end" bold=${sel} dimColor=${typing && !sel}>
                      ${r.title}<${Text} dimColor>  ${[r.type, r.sub ? `${r.sub} sub` : "", r.dub ? `${r.dub} dub` : ""].filter(Boolean).join(" · ")}<//>
                    <//>`} />`}
            ${page.loadingMore ? html`<${Text} dimColor><${Spinner} type="dots" /> loading more…<//>` : null}
          <//>
          ${wide && show ? html`<${Details} show=${show} history=${history} width=${detailsWidth} />` : null}
        <//>
      <//>`;
  } else {
    const isHistory = tab === "history";
    const list = isHistory ? history : later;
    const sel = listSel[tab];
    const show = list[sel];
    hints = ["↑↓ move", "enter open", ...(isHistory ? ["w watch later"] : []), "d remove", "s sub/dub", "tab switch tab", "q quit"];
    body = html`
      <${Box} paddingX=${1} height=${bodyHeight} gap=${1} width="100%">
        <${Box} flexDirection="column" flexGrow=${1} flexBasis=${0}>
          <${List} items=${list} selected=${sel} height=${bodyHeight}
            empty=${isHistory ? "Nothing watched yet." : "Your watch later list is empty. Press w on a show to add it."}
            render=${(item, isSel) => html`
              <${Text} wrap="truncate-end" bold=${isSel}>
                ${item.title}
                <${Text} dimColor>  ${isHistory ? `episode ${item.episode}` : [item.type, item.sub ? `${item.sub} sub` : ""].filter(Boolean).join(" · ")}<//>
              <//>`} />
        <//>
        ${wide && show ? html`<${Details} show=${show} history=${history} width=${detailsWidth} />` : null}
      <//>`;
  }

  return html`
    <${Box} flexDirection="column" height=${rows} width=${cols}>
      <${Header} tab=${tab} mode=${mode} inSubview=${!!view} />
      <${Box} marginTop=${1} flexGrow=${1} width="100%">${body}<//>
      <${Footer} hints=${hints} message=${message} />
    <//>`;
}
