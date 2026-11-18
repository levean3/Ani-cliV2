#!/usr/bin/env bash
# Removes ani-tui from Ubuntu (including WSL): the app, its Node.js download, the ani-tui
# command and the PATH line the installer may have added. Asks before deleting personal data
# and before removing apt packages, and only offers the packages the installer added itself.
# Started by "Uninstall from WSL Ubuntu.cmd", or run directly:
#   bash ~/.local/share/ani-tui/app/installers/uninstall-ubuntu.sh
set -uo pipefail

DATA="$HOME/.local/share/ani-tui"
LAUNCHER="$HOME/.local/bin/ani-tui"
RECORD="$DATA/installed-by-ani-tui.txt"
# same locations src/store.js and src/settings.js use
STATE="${ANI_CLI_HIST_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/ani-cli}"
CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}/ani-cli"

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok() { printf '    \033[32m%s\033[0m\n' "$*"; }
note() { printf '    \033[33m%s\033[0m\n' "$*"; }
ask() {
  local answer=""
  read -r -p "$1 [y/N] " answer || true
  [[ "$answer" =~ ^[[:space:]]*[Yy]([Ee][Ss])?[[:space:]]*$ ]]
}
# true if the launcher is the one the installer wrote (not a developer's symlink or something else)
our_launcher() { [ -f "$LAUNCHER" ] && [ ! -L "$LAUNCHER" ] && grep -q '/.local/share/ani-tui/app/' "$LAUNCHER"; }

printf '\033[1;35mani-tui uninstaller for Ubuntu\033[0m\n'

if [ ! -d "$DATA" ] && ! our_launcher; then
  note "ani-tui doesn't seem to be installed (nothing in $DATA)."
  exit 0
fi
if ! ask "Remove ani-tui from Ubuntu?"; then
  echo "Nothing was changed."
  exit 0
fi
RECORDED=()
[ -f "$RECORD" ] && mapfile -t RECORDED < <(grep -v '^$' "$RECORD")

step "Removing the ani-tui command"
if our_launcher; then
  rm -f "$LAUNCHER"
  ok "Removed $LAUNCHER"
elif [ -L "$LAUNCHER" ]; then
  note "Left $LAUNCHER alone: it links to $(readlink "$LAUNCHER"), not to the installed copy."
else
  ok "Already gone"
fi
if grep -q '^# added by the ani-tui installer$' "$HOME/.bashrc" 2>/dev/null; then
  sed -i '/^# added by the ani-tui installer$/{N;d}' "$HOME/.bashrc"
  ok "Removed the PATH line the installer added to ~/.bashrc"
fi

step "Removing app files"
rm -rf "$DATA"
ok "Deleted $DATA"

step "Your watch history, watch later list and settings"
FILES=()
for f in "$STATE/ani-hsts" "$STATE/watch-later.json" "$CONFIG/ani-tui.json"; do
  [ -e "$f" ] && FILES+=("$f")
done
if [ ${#FILES[@]} -eq 0 ]; then
  ok "None found"
else
  note "Keep these if you might install ani-tui again and want to continue where you left off."
  note "The watch history is shared with ani-cli, if you use that too."
  if ask "Delete your history, watch later list and settings too?"; then
    rm -f "${FILES[@]}"
    rmdir "$STATE" "$CONFIG" 2>/dev/null || true
    ok "Deleted"
  else
    ok "Kept"
  fi
fi

if [ ${#RECORDED[@]} -gt 0 ]; then
  step "Packages the installer added"
  REMOVE=()
  for pkg in "${RECORDED[@]}"; do
    if ask "Also remove $pkg? Say no if anything else uses it."; then REMOVE+=("$pkg"); else ok "Kept $pkg"; fi
  done
  if [ ${#REMOVE[@]} -gt 0 ]; then
    note "Ubuntu may ask for your Ubuntu password. Nothing shows while you type it; that's normal."
    if sudo apt-get remove -y -qq "${REMOVE[@]}" >/dev/null; then
      ok "Removed ${REMOVE[*]}"
      note "Run 'sudo apt autoremove' later to clean up packages they needed."
    else
      note "Could not remove ${REMOVE[*]}. You can try: sudo apt-get remove ${REMOVE[*]}"
    fi
  fi
fi

printf '\n\033[1;32mani-tui has been removed.\033[0m\n'
