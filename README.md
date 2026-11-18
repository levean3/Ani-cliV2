# Ani-cliV2

A personal fork of [ani-cli](https://github.com/pystardust/ani-cli), a shell script for browsing and watching anime from the command line.

Based on upstream ani-cli **v5.1.5**. All credit for the original work goes to the ani-cli authors and contributors.

## Interactive UI (`ani-tui`)

A full-screen terminal interface built with [Ink](https://github.com/vadimdemedes/ink), the
same library Claude Code uses. Needs Node.js 18+ and a player (mpv, or `mpv.exe` on WSL).

```sh
npm install
./bin/ani-tui.js            # or: ./bin/ani-tui.js monogatari --dub
```

- **Search**: results update as you type, with a details panel (type, length, sub/dub
  episode counts, synopsis). Scrolling to the bottom loads the next page.
- **Episodes**: episode titles, watched episodes ticked, opens on the next unwatched one.
  Type a number to jump to it.
- **Now playing**: next, previous, replay, and change quality without leaving the app.
- **History**: shared with `./ani-cli`, so both see the same progress.
- **Watch later**: press `w` on any show to save it for later.
- **Settings**: default sub/dub, quality, subtitle file on/off, player, extra player
  options, accent color, and clearing history or watch later. Saved to
  `~/.config/ani-cli/ani-tui.json`. `--dub`, `-q` and the `ANI_CLI_MODE`,
  `ANI_CLI_QUALITY`, `ANI_CLI_PLAYER`, `ANI_CLI_PLAYER_FLAGS` variables override them for
  one session, and the tab marks which ones are overridden.

| Key | Action |
| --- | --- |
| `↑` `↓` | Move (`↓` from the search box enters the results) |
| `Enter` | Open show / play episode |
| `Tab` / `Shift+Tab` | Switch between Search, History, Watch later, Settings |
| `←` `→` / `Space` | Change a setting (`Enter` edits text, runs actions after a second press) |
| `w` | Add to / remove from watch later |
| `s` | Toggle sub / dub |
| `d` `d` | Remove from history or watch later |
| `n` `p` `r` `q` | Next, previous, replay, quality (while playing) |
| `Esc` | Back |
| `Ctrl+C` | Quit |

`npm run check -- <query>` runs a quick test of search, episodes and stream links against
the live site.

## Original script

```sh
./ani-cli
```

## License

GPL-3.0, same as upstream. See [LICENSE](LICENSE).
