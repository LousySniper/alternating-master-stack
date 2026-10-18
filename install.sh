#!/usr/bin/env bash
# Installs/upgrades the tiling script (and the optional panel widget) for the
# current user, then checks the result.   Usage: ./install.sh [--no-widget]
cd "$(dirname "$0")" || exit 1
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
         floatOnMinSize floatWhenTooSmall detectMaximized newWindowPlacement; do
  kwriteconfig6 --file kwinrc --group "Script-$ID" --key "$k" --delete
done

echo; echo "== installed script files =="
find "$DEST" -type f | sort
[ -f "$DEST/contents/code/main.js" ] || echo "MISSING: main.js"
[ -f "$DEST/contents/ui/config.ui" ] || echo "MISSING: settings page (config.ui)"
echo; echo "Settings: System Settings > Window Management > KWin Scripts > Alternating Master Stack > configure icon."

if [ "$1" != "--no-widget" ]; then
  echo; echo "== panel widget (Tiling Controls) =="
  { kpackagetool6 --type=Plasma/Applet --upgrade widget 2>/dev/null \
      || kpackagetool6 --type=Plasma/Applet --install widget; } && \
    echo "Installed. Right-click the desktop or a panel > Add Widgets > 'Tiling Controls'." && \
    echo "If it is not listed yet:  kquitapp6 plasmashell; kstart plasmashell"
fi

"$QDBUS" org.kde.KWin /KWin reconfigure
echo; echo "Done. Press Meta+Ctrl+D to print the tiling order, sizes and weights to the log:"
echo "  journalctl -f QT_CATEGORY=js QT_CATEGORY=kwin_scripting"
