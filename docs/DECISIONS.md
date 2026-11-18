# Decisions

A log of decisions made on Ani-cliV2: what was decided, why, and what it affects.
Newest entries go at the bottom. Entries are not edited after the fact; if a decision
is reversed, add a new entry that supersedes the old one.

## Template

```md
## NNN. Title

- **Date:** YYYY-MM-DD
- **Status:** Accepted | Superseded by NNN | Rejected

**Context:** What prompted this decision.

**Decision:** What was decided.

**Consequences:** What this changes, trade-offs, follow-ups.
```

---

## 001. Fork ani-cli v5.1.5 as the baseline

- **Date:** 2026-11-18
- **Status:** Accepted

**Context:** We want to improve ani-cli without touching the installed copy at
`/usr/local/bin/ani-cli`.

**Decision:** Copy the unmodified upstream script (v5.1.5, from
[pystardust/ani-cli](https://github.com/pystardust/ani-cli)) into this repo as the
first commit, together with upstream's GPL-3.0 LICENSE and a README crediting the
original authors.

**Consequences:** Every change can be diffed against upstream. The project stays
GPL-3.0. The built-in `-U` update option still downloads upstream and would overwrite
local changes, so it should not be used on this copy until it is changed.

## 002. Use an SSH deploy key for pushing

- **Date:** 2026-11-18
- **Status:** Accepted

**Context:** The Ubuntu (WSL) environment had no GitHub authentication set up.

**Decision:** Generate a dedicated ed25519 key (`~/.ssh/id_ed25519_anicli`, no
passphrase) and add it as a deploy key with write access on this repo only. Commits
use the identity `levean3 <levean3@users.noreply.github.com>`, set for this repo only.

**Consequences:** The key can push to this repo and nothing else. It has no
passphrase, so anyone with access to the WSL home directory can use it.

## 003. Build an interactive UI with Node.js and Ink

- **Date:** 2026-11-18
- **Status:** Accepted

**Context:** The original menus are fzf lists: pick a show, then pick an episode, with no
way to see details, go back, or browse history comfortably. The goal is an interface
that feels like the Claude Code terminal.

**Decision:** Write a new app, `ani-tui`, with Ink (React for the terminal, which Claude
Code also uses). Node.js 22 was already installed in Ubuntu. The scraper is ported from
the shell functions into `src/provider.js`; playback still goes through mpv. The original
`ani-cli` script stays in the repo unchanged.

**Consequences:** Node.js is now a dependency for the UI. Fixes to the scraper may need
to be made in both `ani-cli` and `src/provider.js` while both exist. Considered and
rejected: Python + Textual (more dashboard-like), Go + Bubble Tea (not installed, most
work), and upgrading fzf in the shell script (would still feel like fzf).

## 004. Use htm instead of JSX

- **Date:** 2026-11-18
- **Status:** Accepted

**Context:** JSX needs a compile step (Babel, esbuild or similar) before Node can run it.

**Decision:** Write components with [htm](https://github.com/developit/htm) tagged
templates, which run directly in Node.

**Consequences:** No build step: edit a file and rerun. Templates use `<${Box}>…<//>`
syntax instead of `<Box>…</Box>` and editors highlight it less well. Can switch to JSX
later if the UI grows.

## 005. Share history with ani-cli; store watch later as JSON

- **Date:** 2026-11-18
- **Status:** Accepted

**Context:** Users may switch between `ani-cli` and `ani-tui`.

**Decision:** `ani-tui` reads and writes the same history file as `ani-cli`
(`~/.local/state/ani-cli/ani-hsts`, `episode<TAB>id<TAB>title` per line). The new watch
later list is stored next to it as `watch-later.json`, which `ani-cli` ignores.
`ANI_CLI_HIST_DIR` moves both.

**Consequences:** Progress is shared in both directions. The history format can't gain new
fields without breaking `ani-cli`.

## 006. Follow the site's redirect to its current domain

- **Date:** 2026-11-18
- **Status:** Accepted

**Context:** `hianime.at` now answers every request with a redirect to `hianime.fm`. On
this WSL setup each new connection also spends about 5 s on DNS, so a redirect doubled
the wait.

**Decision:** After the first redirect, `src/provider.js` sends later requests straight to
the new domain. `ANI_CLI_BASE` overrides the domain. Requests time out after 20 s.

**Consequences:** One slow lookup per session instead of two per request. The 5 s DNS
delay itself is a system setting (glibc sending IPv4 and IPv6 lookups together), not
something the app fixes.

## 007. Settings tab with a saved config file

- **Date:** 2026-11-18
- **Status:** Accepted

**Context:** ani-cli is configured only through `ANI_CLI_*` environment variables and
flags, which have to be set before every run and can't be changed while it's open.

**Decision:** Add a Settings tab to `ani-tui` covering audio (sub/dub), quality, subtitle
file on/off, player, extra player options, accent color, and clearing history or watch
later. Changes apply immediately and are saved to
`$XDG_CONFIG_HOME/ani-cli/ani-tui.json` (usually `~/.config/ani-cli/`). For a single
session, flags beat environment variables, which beat the file. The tab labels any
setting that is being overridden, and changing it there saves the choice and drops the
override.

**Consequences:** Existing `ANI_CLI_*` habits keep working. Clearing history also clears
`./ani-cli`'s history, because they share the file (decision 005); the tab says so before
asking for confirmation. `s` still switches sub/dub for the current session only, without
saving.
