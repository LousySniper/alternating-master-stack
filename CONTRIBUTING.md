# Contributing

Bug reports and pull requests are welcome.

- `script/contents/code/main.js` is the whole tiling script (plain KWin JavaScript, no build step).
- `npm test` runs `tests/harness.js`: a mock KWin that loads the real script and checks layouts, shortcuts, dragging, resizing and settings. Add a test for every behaviour you change.
- The mock cannot reproduce every real-KWin timing (Wayland clients that resize late, for example). Say in the pull request whether you also tried it on a real desktop.
- To add an app to a "floats by default" category, put its window class (lower case; both the `org.kde.x` and short spelling if they differ) into the right list in `FLOAT_GROUPS`. Apps that stay in a workspace for hours (browsers, IDEs, chat, mail, office) should not float by default; the tests check this.
- Window order must never change automatically; only the user's actions reorder windows.
