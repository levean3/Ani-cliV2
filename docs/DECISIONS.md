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
