# Changelog

## 1.1
- Middle-click floats / tiles the window once the click is over, not while KWin is still handling the press.
- Floating first: an option to open every window floating and tile only the apps you pick.
- Middle-click a title bar, or Meta+middle-click anywhere in any window, to tile / float that one window (`install.sh --middle-click`). Tiling a window is not remembered once it closes.
- Window menu (Alt+F3) → *Tiling*: *Tile this window* and *Always tile this app*. Works for apps that draw their own title bar too.

## 1.0
- Alternating master/stack tiling with smart sizing, keyboard control, adjustable ratios, drag-to-swap, floating toggle, 5-tile limit with floating overflow, drag a floating window into the tiling, observed-minimum handling, optional panel widget.
- Settings page: a switch for every category of app that floats by default, the tile limit, and your own always-float / always-tile class lists. "Reload Settings" shortcut.
- `uninstall.sh`.
- Mouse resizing follows the edge you drag, on every window (any shared edge, mirrored layouts included).
- A neighbour that is slow to follow a resize no longer gets remembered as "can't shrink", which undid your resize with 3+ windows.
- Floating windows only snap into the tiling when released over a tile's title bar.
- Much broader list of apps that float: music and video players, text openers, photo viewers, tools, and more.
