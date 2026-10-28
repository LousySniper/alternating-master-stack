# Alternating Master Stack

<p align="center">
  <img src="docs/tiling.svg" alt="Animation: windows tile in an alternating split, a sixth window floats, then a floating window is dropped on a title bar to join the tiling" width="760">
</p>

A tiling script for **KDE Plasma 6** (KWin). Windows are laid out in an alternating split: the first window takes half of the screen, the next takes half of what is left (stacked), the next half of that (side by side), and so on. Sizes adapt to what is open, and **the order of your windows is never changed automatically**.

> Status: developed against Plasma 6; the optional panel widget has the least testing. Please open an issue if something misbehaves.

## Features

- **Alternating tiling** with smart gaps; portrait and very wide screens flip the split sensibly.
- **Smart sizing**: browsers and editors get more room than terminals, chat or music; a window that opened large asks for more; declared minimum sizes are honoured. Anything you size yourself overrides it, and *Reset Ratios* hands control back.
- **New windows go to the end**, never to the master. Minimized windows that come back, and windows moved to another desktop or screen, also go to the end. Maximize and fullscreen keep a window's place.
- **Activities aware**: only windows on the current activity are tiled, and each screen, desktop and activity keeps its own sizes.
- **At most 5 tiles** per screen and desktop (configurable); further windows float, cascaded. When a tile frees up the next floating window takes it.
- **Apps that open floating** (they don't use up tiles): file managers, terminals, settings and system tools, music and video players, text openers, photo viewers, screenshot/picker tools, calculators, password managers, archive and download tools. Every category is a switch in the settings page, and you can add your own apps.
- **Floating first** (optional): every window opens floating, and you tile single windows with a **middle-click**, the window menu, the panel widget or Meta+Shift+F; whole apps with the window menu or Meta+Ctrl+F (remembered across restarts).
- **Nothing gets lost behind the tiles**: when you tile a window, the windows that aren't tiles are minimized (switch in the settings page).
- **Mouse**: drag a tile onto another to swap; drag a floating window onto a tile's **title bar** to put it into the tiling (floating windows can otherwise be moved freely without snapping); drag any shared edge to resize.
- **Keyboard** control of focus, swapping, sizes, floating, rotation, mirroring and gaps.
- Optional **panel widget** ("Tiling Controls") with buttons and a size slider; middle-click its icon to float / tile the last used window.

## Install

Requires Plasma 6, `kpackagetool6`, `kwriteconfig6` and `qdbus6`.

```sh
git clone https://github.com/LousySniper/alternating-master-stack
cd alternating-master-stack
bash install.sh              # add --no-widget to skip the panel widget
```

For floating first with middle-click as the tile toggle:

```sh
bash install.sh --float-all --middle-click
```

Uninstall with `bash uninstall.sh` (`--keep-settings` keeps your saved settings).

Manual install: copy `script/` to `~/.local/share/kwin/scripts/alternating-master-stack/` and enable it under *System Settings → Window Management → KWin Scripts*.

## Floating first and tiling single windows

With *All windows open floating* every window opens where KWin puts it and nothing tiles until you say so. You float / tile **one window** at a time (tiling one Konsole doesn't tile the others) with:

- **middle-click** its title bar, or **Meta+middle-click** anywhere in it (any app, also those that draw their own title bar, like Firefox, Chrome or VS Code), with `--middle-click`,
- the window menu (**Alt+F3**, or right-click the title bar) → *Tiling* → *Tile this window*,
- the **Tiling Controls** widget: *Float / tile this window* at the top of the popup, or just **middle-click the panel icon**,
- **Meta+Shift+F**.

A window that is the only tile on its screen is **maximized** (it fills the screen either way). Floating it, or pressing the title bar's restore button, puts it back where it was before you tiled it.

Tiling a window is not remembered: once it is closed, the app's next window opens floating again (unless you chose *Always tile this app*).

When you tile a window, every window on that screen, desktop and activity that isn't a tile is **minimized**, so none is left hidden behind the tiles; bring them back from the task bar (they come back floating). Windows without a task bar entry are left alone. Turn it off with *When you tile a window, minimize the windows that aren't tiles* in the settings page.

### Middle-click

A KWin script can't see mouse clicks, so `--middle-click` binds middle-click on title bars, and Meta+middle-click in windows, to KWin's *Decrease opacity* (in `[MouseBindings]` of `kwinrc`). The script catches that 10% opacity step on the window under the cursor, undoes it, and floats / tiles the window. The settings page has the matching switch. `uninstall.sh` gives the bindings back to KWin's defaults. It doesn't mix with window rules that dim inactive windows by exactly 10%.

### Whole apps

To make a whole app always tile (or always float), use *Tiling* → *Always tile this app* in the window menu, *Always float / tile this app* in the widget, or **Meta+Ctrl+F**. App choices are saved to `~/.config/kwinrc` (`tiledApps` / `floatedApps` under `[Script-alternating-master-stack]`) and win over the settings page, since they are the newer decision. To undo one, use the same menu entry or Meta+Ctrl+F again, or delete it from `tiledApps` in `~/.config/kwinrc`.

## Settings

*System Settings → Window Management → KWin Scripts → Alternating Master Stack → configure*:

- all windows floating first, middle-click as the tile toggle, and minimizing the untiled windows when you tile one,
- a switch per category of apps that open floating,
- the most windows tiled per screen and desktop,
- the gap between windows and at the screen edge,
- on-screen messages on / off,
- your own *always float* and *always tile* window classes (comma separated; *always tile* wins over every category).

The tile limit, gaps and messages apply as soon as you press *Apply*. Floating rules reach windows you open afterwards; windows already open keep their state, so turn the script off and on to apply everything. A *Reload Settings* shortcut is available to bind.

To find an app's window class, press **Meta+Ctrl+F** on it: the on-screen message shows the class, and the app floats or tiles from then on (press again to undo).

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
| Meta+Ctrl+F | always float / tile this app (saved) |


## License

GPL-3.0-or-later, see [LICENSE](LICENSE).
