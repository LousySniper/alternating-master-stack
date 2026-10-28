#!/usr/bin/env bash
# Removes the tiling script, its saved settings and the optional panel widget.
# Usage: bash uninstall.sh [--keep-settings]
ID=alternating-master-stack
WIDGET_ID=$(sed -n 's/.*"Id": *"\([^"]*\)".*/\1/p' "$(dirname "$0")/widget/metadata.json" 2>/dev/null | head -1)
QDBUS=$(command -v qdbus6 || command -v qdbus)

echo "== stopping the script =="
[ -n "$QDBUS" ] && "$QDBUS" org.kde.KWin /Scripting org.kde.kwin.Scripting.unloadScript "$ID" >/dev/null 2>&1
kwriteconfig6 --file kwinrc --group Plugins --key "${ID}Enabled" false

echo "== removing the script =="
kpackagetool6 --type=KWin/Script --remove "$ID" >/dev/null 2>&1
rm -rf "$HOME/.local/share/kwin/scripts/$ID"

if [ "$1" != "--keep-settings" ]; then
  echo "== removing saved settings =="
  kwriteconfig6 --file kwinrc --group Plugins --key "${ID}Enabled" --delete
  kwriteconfig6 --file kwinrc --group "Script-$ID" --delete 2>/dev/null
  # kwriteconfig6 can't delete a whole group on every version: remove it by hand if left
  f="$HOME/.config/kwinrc"
  if [ -f "$f" ] && grep -q "^\[Script-$ID\]" "$f"; then
    sed -i "/^\[Script-$ID\]/,/^\[/{/^\[Script-$ID\]/d;/^\[/!d}" "$f"
  fi
fi

# Give middle-click back to KWin's defaults if install.sh --middle-click set it.
for k in CommandActiveTitlebar2 CommandInactiveTitlebar2 CommandAll2; do
  [ "$(kreadconfig6 --file kwinrc --group MouseBindings --key "$k")" = "Decrease Opacity" ] && \
    kwriteconfig6 --file kwinrc --group MouseBindings --key "$k" --delete
done

echo "== removing the panel widget (if installed) =="
if [ -n "$WIDGET_ID" ]; then
  kpackagetool6 --type=Plasma/Applet --remove "$WIDGET_ID" >/dev/null 2>&1 && echo "removed $WIDGET_ID" || echo "not installed"
fi

[ -n "$QDBUS" ] && "$QDBUS" org.kde.KWin /KWin reconfigure
echo
echo "Done. Windows keep their current positions; they just aren't managed any more."
echo "If a panel widget was in use, restart the shell to clear it:  kquitapp6 plasmashell; kstart plasmashell"
