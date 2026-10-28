# Changelog

## 1.8
- Removed the debug log and the log messages, with their shortcuts (Meta+Ctrl+D, Meta+Ctrl+Shift+D). Meta+Ctrl+F's on-screen message shows an app's class instead. Only errors are still written to the log.
- A lone tile is maximized through KWin instead of being sized to fill the screen. Floating it, or restoring it with the title-bar button, is KWin's own restore: it goes back to where it was before it tiled, and geometry animations no longer leave the old window on the desktop. When a second window tiles, the first is restored and both are tiled as usual.
- Middle-click floats / tiles the window once the click is over, not while KWin is still handling the press.
- Floating first: an option to open every window floating and tile only the apps you pick.
- Middle-click a title bar, or Meta+middle-click anywhere in any window, to tile / float that one window (`install.sh --middle-click`). Tiling a window is not remembered once it closes.
- Window menu (Alt+F3) → *Tiling*: *Tile this window* and *Always tile this app*. Works for apps that draw their own title bar too.
- Floating a fullscreen or maximized window leaves that state first (it used to be resized while KWin still treated it as fullscreen, which could leave the old frame on screen; a maximized window didn't float at all). This includes windows that were already floating when maximized, which is the usual case with "All windows open floating": middle-clicking one used to tile it while it was still maximized. It goes back to where it was before it was maximized, as when you un-maximize it yourself.
- Tiling a window minimizes the windows that aren't tiles, so none hides behind the tiles (switch in the settings page).
- Tiling Controls widget: *Float / tile this window* at the top; middle-click the panel icon to toggle without opening it.
- Per-app choices (the window menu, the widget, Meta+Ctrl+F) are saved and survive restarts; Meta+Ctrl+F used to last only for the session.
- Activities: only windows on the current activity are tiled (windows on other activities used to be pulled into the layout). Each activity keeps its own sizes and mirroring; a window moved to another activity and back arrives at the end.
- Settings apply as soon as you press Apply: the tile limit, gaps and messages no longer wait for the next window to open.
- Settings page: gap between windows, gap at the screen edge, and on-screen messages on/off.
- Package versions now match the script (`metadata.json` said 1.0).

## 1.7
- Settings page: a switch for every category of app that floats by default, the tile limit, and your own always-float / always-tile class lists. "Reload Settings" shortcut.
- `uninstall.sh`.

## 1.6.2
- Mouse resizing follows the edge you drag, on every window (any shared edge, mirrored layouts included).

## 1.6.1
- A neighbour that is slow to follow a resize no longer gets remembered as "can't shrink", which undid your resize with 3+ windows.

## 1.6
- Floating windows only snap into the tiling when released over a tile's title bar.

## 1.5
- Much broader list of apps that float: music and video players, text openers, photo viewers, tools, and more.

## 1.0 - 1.4
- Alternating master/stack tiling with smart sizing, keyboard control, adjustable ratios, drag-to-swap, floating toggle, 5-tile limit with floating overflow, drag a floating window into the tiling, observed-minimum handling, optional panel widget.
