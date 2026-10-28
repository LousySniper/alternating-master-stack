#!/usr/bin/env bash
# Installs/upgrades the tiling script (and the optional panel widget) for the
# current user, then checks the result.
# Usage: ./install.sh [--no-widget] [--float-all] [--middle-click]
#   --float-all     all windows open floating; you pick what tiles
#   --middle-click  middle-click a title bar, or Meta+middle-click anywhere in
#                   a window, to tile / float it (binds middle-click to KWin's
#                   "Decrease opacity", which the script turns into the toggle)
cd "$(dirname "$0")" || exit 1
WIDGET=1; FLOAT_ALL=0; MIDDLE=0
for arg in "$@"; do
  case "$arg" in
    --no-widget)   WIDGET=0 ;;
    --float-all)   FLOAT_ALL=1 ;;
    --middle-click) MIDDLE=1 ;;
    *) echo "unknown option: $arg"; exit 1 ;;
  esac
done
ID=alternating-master-stack
DEST="$HOME/.local/share/kwin/scripts/$ID"
QDBUS=$(command -v qdbus6 || command -v qdbus)

# Unload the running copy, and remove the old package completely so files
# from older versions can't linger.
"$QDBUS" org.kde.KWin /Scripting org.kde.kwin.Scripting.unloadScript "$ID" >/dev/null 2>&1
kpackagetool6 --type=KWin/Script --remove "$ID" >/dev/null 2>&1
rm -rf "$DEST"

kpackagetool6 --type=KWin/Script --install script || exit 1
kwriteconfig6 --file kwinrc --group Plugins --key "${ID}Enabled" true

# Settings keys from old versions that no longer exist; remove them.
for k in innerGap outerGap defaultLayout masterCount defaultRatio showMessages ignoredClasses \
         floatOnMinSize floatWhenTooSmall detectMaximized newWindowPlacement keepBelowToggle; do
  kwriteconfig6 --file kwinrc --group "Script-$ID" --key "$k" --delete
done

echo; echo "== installed script files =="
find "$DEST" -type f | sort
[ -f "$DEST/contents/code/main.js" ] || echo "MISSING: main.js"
[ -f "$DEST/contents/ui/config.ui" ] || echo "MISSING: settings page (config.ui)"
[ "$FLOAT_ALL" = 1 ] && kwriteconfig6 --file kwinrc --group "Script-$ID" --key floatAll true

if [ "$MIDDLE" = 1 ]; then
  kwriteconfig6 --file kwinrc --group "Script-$ID" --key middleClickToggle true
  for k in CommandActiveTitlebar2 CommandInactiveTitlebar2 CommandAll2; do
    kwriteconfig6 --file kwinrc --group MouseBindings --key "$k" "Decrease Opacity"
  done
  echo "Middle-click on a title bar, or Meta+middle-click in a window = tile toggle"
fi

echo; echo "Settings: System Settings > Window Management > KWin Scripts > Alternating Master Stack > configure icon."

if [ "$WIDGET" = 1 ]; then
  echo; echo "== panel widget (Tiling Controls) =="
  { kpackagetool6 --type=Plasma/Applet --upgrade widget 2>/dev/null \
      || kpackagetool6 --type=Plasma/Applet --install widget; } && \
    echo "Installed. Right-click the desktop or a panel > Add Widgets > 'Tiling Controls'." && \
    echo "If it is not listed yet:  kquitapp6 plasmashell; kstart plasmashell"
fi

"$QDBUS" org.kde.KWin /KWin reconfigure
echo; echo "Done."
