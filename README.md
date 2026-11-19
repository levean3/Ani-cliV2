# Ani-cliV2

A personal fork of [ani-cli](https://github.com/pystardust/ani-cli), a shell script for browsing and watching anime from the command line.

Based on upstream ani-cli **v5.1.5**. All credit for the original work goes to the ani-cli authors and contributors.

## Easy install

1. On this page, click the green **Code** button, then **Download ZIP**.
2. Open the downloaded file and click **Extract all**.
3. In the extracted folder, double-click one of:
   - **`Install on Windows.cmd`**: for normal Windows. Installs Node.js and the mpv video
     player if needed, then adds an **ani-tui** shortcut to your Desktop and Start menu.
   - **`Install in WSL Ubuntu.cmd`**: for WSL. Sets up Ubuntu if it's missing, then
     installs everything inside it. Afterwards, type `ani-tui` in Ubuntu.

If Windows shows "Windows protected your PC", click **More info**, then **Run anyway**.
Windows may also ask for permission to install Node.js or mpv; click **Yes**.

To update, download the newest ZIP and run the installer again. You can delete the
downloaded folder after installing.

### Uninstall

- **Windows:** open the Start menu and click **Uninstall ani-tui**, or remove **ani-tui**
  in **Settings > Apps**, or double-click **`Uninstall from Windows.cmd`**.
- **WSL Ubuntu:** double-click **`Uninstall from WSL Ubuntu.cmd`**, or run
  `bash ~/.local/share/ani-tui/app/installers/uninstall-ubuntu.sh` in Ubuntu.

The uninstaller asks before deleting your watch history, watch later list and settings
(kept unless you say yes). It also offers to remove Node.js or mpv, but only if the
installer installed them.

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

### Manual install on Windows (no WSL needed)

The installer above does this for you.

1. Install [Node.js LTS](https://nodejs.org) and mpv. With winget:
   ```
   winget install --id OpenJS.NodeJS.LTS --exact
   winget install --id shinchiro.mpv --exact
   ```
   VLC works too; it's found in its normal install folder even if it isn't on PATH.
2. Open a new terminal (so it sees Node), then:
   ```
   git clone https://github.com/levean3/Ani-cliV2.git
   cd Ani-cliV2
   npm install
   npm install -g .
   ```
3. Run `ani-tui` from any folder. Windows Terminal is recommended.

Keep the cloned folder: the `ani-tui` command points to it. To update, run `git pull` in it.

If PowerShell says "running scripts is disabled on this system", either run
`ani-tui.cmd` instead, or allow npm's scripts once with
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

`npm run check -- <query>` runs a quick test of search, episodes and stream links against
the live site.

## Original script

```sh
./ani-cli
```

## License

GPL-3.0, same as upstream. See [LICENSE](LICENSE).

The Windows icon (`assets/ani-tui.ico`) is fan art of Ryo Yamada from *Bocchi the Rock!*, made from a Discord emoji. It is not covered by the GPL and belongs to its respective owners.
