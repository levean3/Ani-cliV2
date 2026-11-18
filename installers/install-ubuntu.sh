#!/usr/bin/env bash
# Installs ani-tui in Ubuntu (including WSL): Node.js 18+, a video player, the app itself in
# ~/.local/share/ani-tui, and an `ani-tui` command in ~/.local/bin.
# Started by "Install in WSL Ubuntu.cmd", or run directly: bash installers/install-ubuntu.sh
# Running it again updates the app.
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$HOME/.local/share/ani-tui"
APP="$DATA/app"
BIN="$HOME/.local/bin"
NODE_VERSION="v22.22.0" # official build used when Ubuntu's own Node.js is too old

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok() { printf '    \033[32m%s\033[0m\n' "$*"; }
note() { printf '    \033[33m%s\033[0m\n' "$*"; }
fail() { printf '\n\033[31m%s\033[0m\n' "$*"; exit 1; }
trap 'fail "Something went wrong on line $LINENO. Check your internet connection and run the installer again."' ERR

# apt packages this installer added, so the uninstaller only offers to remove those
RECORD="$DATA/installed-by-ani-tui.txt"
record() {
  mkdir -p "$DATA"
  printf '%s\n' "$@" >>"$RECORD"
  sort -u -o "$RECORD" "$RECORD"
}

node_major() { "$1" --version 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || echo 0; }

printf '\033[1;35mani-tui installer for Ubuntu\033[0m\n'
echo "This installs everything ani-tui needs. It takes a few minutes."
[ "$(id -u)" -eq 0 ] && fail "Run this as your normal user, not as root."

# --- system packages ----------------------------------------------------------
step "Installing system packages"
note "Ubuntu may ask for your Ubuntu password. Nothing shows while you type it; that's normal."
sudo apt-get update -qq
sudo apt-get install -y -qq ca-certificates curl xz-utils >/dev/null
ok "Done"

# --- Node.js ------------------------------------------------------------------
step "Checking for Node.js"
NODE=""
if command -v node >/dev/null && [ "$(node_major node)" -ge 18 ] && command -v npm >/dev/null; then
  NODE="$(command -v node)"
elif ! command -v node >/dev/null; then
  note "Installing Node.js from Ubuntu"
  sudo apt-get install -y -qq nodejs npm >/dev/null || true
  if command -v node >/dev/null; then record nodejs npm; fi
  if command -v node >/dev/null && [ "$(node_major node)" -ge 18 ]; then NODE="$(command -v node)"; fi
fi
if [ -z "$NODE" ]; then
  # Ubuntu 22.04 and older ship Node.js versions that are too old; use the official build
  case "$(uname -m)" in
    x86_64) ARCH=x64 ;;
    aarch64 | arm64) ARCH=arm64 ;;
    *) fail "Unsupported processor: $(uname -m)" ;;
  esac
  NAME="node-$NODE_VERSION-linux-$ARCH"
  note "Downloading Node.js $NODE_VERSION from nodejs.org"
  TMP="$(mktemp -d)"
  curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/$NAME.tar.xz" -o "$TMP/node.tar.xz"
  curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt" -o "$TMP/SHASUMS256.txt"
  (cd "$TMP" && grep " $NAME.tar.xz\$" SHASUMS256.txt | sed "s/$NAME.tar.xz/node.tar.xz/" | sha256sum -c --quiet) ||
    fail "The Node.js download was damaged. Run the installer again."
  rm -rf "$DATA/node"
  mkdir -p "$DATA/node"
  tar -xJf "$TMP/node.tar.xz" -C "$DATA/node" --strip-components=1
  rm -rf "$TMP"
  NODE="$DATA/node/bin/node"
fi
export PATH="$(dirname "$NODE"):$PATH"
ok "Node.js $("$NODE" --version)"

# --- video player -------------------------------------------------------------
step "Checking for a video player"
if grep -qi microsoft /proc/sys/kernel/osrelease 2>/dev/null && command -v mpv.exe >/dev/null; then
  ok "Using mpv from Windows: $(command -v mpv.exe)"
elif command -v mpv >/dev/null; then
  ok "mpv found"
else
  note "Installing mpv (this is the biggest download)"
  sudo apt-get install -y -qq mpv >/dev/null
  record mpv
  ok "mpv installed"
fi

# --- the app ------------------------------------------------------------------
step "Copying ani-tui to $APP"
rm -rf "$APP"
mkdir -p "$APP"
tar -C "$SRC" --exclude=./node_modules --exclude=./.git -cf - . | tar -C "$APP" -xf -
ok "Files copied"

step "Installing ani-tui libraries"
(cd "$APP" && npm ci --omit=dev --no-fund --no-audit --loglevel=error --update-notifier=false)
ok "Libraries installed"

# --- command ------------------------------------------------------------------
step "Adding the ani-tui command"
mkdir -p "$BIN"
if [ -L "$BIN/ani-tui" ]; then note "Replacing the existing ani-tui link ($(readlink "$BIN/ani-tui"))"; fi
rm -f "$BIN/ani-tui"
cat >"$BIN/ani-tui" <<EOF
#!/bin/sh
exec "$NODE" "$APP/bin/ani-tui.js" "\$@"
EOF
chmod +x "$BIN/ani-tui"
case ":$PATH:" in
  *":$BIN:"*) ;;
  *)
    # Ubuntu's ~/.profile adds ~/.local/bin on login when it exists; make sure for other shells too
    if ! grep -q 'HOME/.local/bin' "$HOME/.bashrc" 2>/dev/null; then
      printf '\n# added by the ani-tui installer\nexport PATH="$HOME/.local/bin:$PATH"\n' >>"$HOME/.bashrc"
    fi
    ;;
esac
ok "Installed $BIN/ani-tui"

printf '\n\033[1;32mDone!\033[0m Open a new Ubuntu window and type: ani-tui\n'
if grep -qi microsoft /proc/sys/kernel/osrelease 2>/dev/null; then
  echo "From Windows, you can also run it with: wsl -d Ubuntu -- bash -lc ani-tui"
fi
echo "To update later, download the newest version and run this installer again."
echo "To remove it, run: bash ~/.local/share/ani-tui/app/installers/uninstall-ubuntu.sh"
