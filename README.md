# Alternating Master Stack

A tiling script for **KDE Plasma 6** (KWin). Windows are laid out in an alternating split: the first window takes half of the screen, the next takes half of what is left (stacked), the next half of that (side by side), and so on. Sizes adapt to what is open, and **the order of your windows is never changed automatically**.

> Status: developed against Plasma 6; the optional panel widget has the least testing. The automated tests run against a mock KWin, so real-desktop behaviour (especially Wayland timing) may differ. Please open an issue if something misbehaves.

## Features

- **Alternating tiling** with smart gaps; portrait and very wide screens flip the split sensibly.
- **Smart sizing**: browsers and editors get more room than terminals, chat or music; a window that opened large asks for more; declared minimum sizes are honoured. Anything you size yourself overrides it, and *Reset Ratios* hands control back.
- **New windows go to the end**, never to the master. Minimized windows that come back, and windows moved to another desktop or screen, also go to the end. Maximize and fullscreen keep a window's place.
- **At most 5 tiles** per screen and desktop (configurable); further windows float, cascaded. When a tile frees up the next floating window takes it.
- **Apps that open floating** (they don't use up tiles): file managers, terminals, settings and system tools, music and video players, text openers, photo viewers, screenshot/picker tools, calculators, password managers, archive and download tools. Every category is a switch in the settings page, and you can add your own apps.
- **Mouse**: drag a tile onto another to swap; drag a floating window onto a tile's **title bar** to put it into the tiling (floating windows can otherwise be moved freely without snapping); drag any shared edge to resize.
- **Keyboard** control of focus, swapping, sizes, floating, rotation, mirroring and gaps.
- Optional **panel widget** ("Tiling Controls") with buttons and a size slider.

## Install

Requires Plasma 6, `kpackagetool6`, `kwriteconfig6` and `qdbus6`.

```sh
git clone https://github.com/LousySniper/alternating-master-stack
cd alternating-master-stack
bash install.sh              # add --no-widget to skip the panel widget
```

Uninstall with `bash uninstall.sh` (`--keep-settings` keeps your saved settings).

Manual install: copy `script/` to `~/.local/share/kwin/scripts/alternating-master-stack/` and enable it under *System Settings → Window Management → KWin Scripts*.

## Settings

*System Settings → Window Management → KWin Scripts → Alternating Master Stack → configure*:

- a switch per category of apps that open floating,
- the most windows tiled per screen and desktop,
- your own *always float* and *always tile* window classes (comma separated; *always tile* wins over every category).

Changes reach windows you open afterwards. Windows already open keep their state; turn the script off and on to apply everything. A *Reload Settings* shortcut is available to bind.

To find an app's window class, press **Meta+Ctrl+F** on it: the class is printed to the log (`journalctl -f QT_CATEGORY=js QT_CATEGORY=kwin_scripting`), and the app floats or tiles for the rest of the session so you can try it.

## Shortcuts

Rebind them under *System Settings → Keyboard → Shortcuts*.

| Keys | Action |
|---|---|
| Meta+H / J / K / L | focus left / down / up / right |
| Meta+Shift+H / J / K / L | swap with the neighbour |
| Meta+Alt+J / K | focus next / previous window in tile order |
| Meta+Return | promote to master |
| Meta+Ctrl+L / H | wider / narrower (5% steps) |
| Meta+Ctrl+K / J | taller / shorter (5% steps) |
| Meta+Ctrl+0 | reset sizes |
| Meta+Ctrl+S | smart sizing on / off |
| Meta+Ctrl+R / Meta+Ctrl+Shift+R | rotate windows forward / backward |
| Meta+Ctrl+M | mirror left-right |
| Meta+Ctrl+G | gaps on / off |
| Meta+Shift+F | float (centred) / tile the focused window |
| Meta+Ctrl+F | always float / tile this app (this session) |
| Meta+Ctrl+D | print tiling order, sizes and reasons to the log |
| Meta+Ctrl+Shift+D | debug log on / off |
| unbound | *Share 30 … Share 80* (exact share of the focused window's split), *Reload Settings* |

## Tuning in the file

Gaps, smart-sizing weights, size limits and the lists of floating apps are constants at the top of `script/contents/code/main.js`. Edit, then turn the script off and on.

## Development

```sh
npm test      # mock-KWin tests, no KDE needed (Node 18+)
```

See [CONTRIBUTING.md](CONTRIBUTING.md). Bugs: please include your Plasma version, X11/Wayland, and the output of **Meta+Ctrl+D**.

## License

GPL-3.0-or-later, see [LICENSE](LICENSE).
