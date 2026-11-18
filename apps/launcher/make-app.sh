#!/bin/bash
# Builds "AI Management Office.app" in ~/Applications as an AppleScript applet that runs start.command.
# Re-run this if you move the project folder. Local only; nothing is installed system-wide.
# Applet (not a bare shell bundle) so macOS can ask once for permission to read ~/Documents.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$HOME/Applications/AI Management Office.app"
mkdir -p "$HOME/Applications"
if [ -e "$APP" ]; then mv "$APP" "$HOME/.Trash/AI Management Office $(date +%s).app"; fi

# A login shell is used so Node (Homebrew/nvm) is found even though Finder gives apps a minimal PATH.
osacompile -o "$APP" -e "do shell script \"/bin/zsh -lc \" & quoted form of \"'$HERE/start.command'\" & \" >/dev/null 2>&1 &\""
echo "Created: $APP"
