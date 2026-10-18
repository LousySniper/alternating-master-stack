/*
 * Alternating Master Stack v1.7 — KDE Plasma 6
 *
 * Alternating tiling: window k takes the first part of a split of the
 * remaining space; the split direction alternates (side by side, then
 * stacked, ...). Window order is NEVER changed automatically.
 *
 * Smart sizing: split sizes are chosen from what is open, so the layout
 * adapts to the windows instead of always cutting 50/50:
 *   - kind of app (browser/editor get more room, terminals/chat/music less)
 *   - the size a window asked for when it opened
 *   - declared minimum sizes (honoured as far as possible, never floated)
 *   - how many windows there are (the master keeps a bit of extra room)
 *   - screen shape (portrait screens start with a stacked split; very wide
 *     regions are split side by side)
 * Sizes you set yourself (keys, mouse, "Share") always win; "Reset Ratios"
 * hands control back to smart sizing.
 *
 * Limit: at most MAX_TILED windows are tiled per screen and desktop. Windows
 * beyond that float (centred, cascaded). Drag a floating window onto a tile's
 * title bar: with room it joins the tiling (no keyboard shortcut needed);
 * when full it takes the tile and the replaced window floats where the dragged
 * one came from. When a tile frees up, the next floating window tiles.
 *
 * Quick-use apps (anything that is not a constant part of a workspace: file
 * managers, terminals, settings and system tools, music and video players,
 * text openers, photo viewers, screenshots, calculators, password managers,
 * archive tools, downloads: see FLOAT_GROUPS; each category can be
 * switched off in the settings page)
 * open floating and don't count toward the limit, which leaves the tiles for
 * the windows you keep. Meta+Shift+F tiles one; Meta+Ctrl+F changes a whole
 * app for this session so you can experiment.
 *
 * Order rules: new windows go to the END. A window restored from minimized,
 * or moved to another desktop/screen, also goes to the end. Maximize and
 * fullscreen keep a window's place.
 *
 * Shortcuts (rebind in System Settings > Keyboard > Shortcuts)
 *  Meta+H/J/K/L              focus left/down/up/right
 *  Meta+Shift+H/J/K/L        swap with neighbour
 *  Meta+Alt+J / Meta+Alt+K   focus next / previous window in tile order
 *  Meta+Return               promote to master (swap with master if already)
 *  Meta+Ctrl+L / H           window wider / narrower (5% steps)
 *  Meta+Ctrl+K / J           window taller / shorter (5% steps)
 *  Meta+Ctrl+0               reset sizes (smart sizing decides again)
 *  Meta+Ctrl+S               smart sizing on / off
 *  Meta+Ctrl+R / Meta+Ctrl+Shift+R   rotate windows forward / backward
 *  Meta+Ctrl+M               mirror left-right
 *  Meta+Ctrl+G               gaps on / off
 *  Meta+Shift+F              float (centred, raised) / unfloat; on a window that
 *                            floats only because of the limit: take the last tile
 *  Meta+Ctrl+F               always float / tile this app (this session)
 *  Meta+Ctrl+Shift+D         debug log on / off (what the script moves and why)
 *  Meta+Ctrl+D               print tiling order, sizes and why-not to the log
 *  (unbound, assignable) Share 30 ... Share 80: give the focused window
 *  30-80% of its split
 *
 * Settings: System Settings > Window Management > KWin Scripts > configure
 * (which categories float, the tile limit, your own always-float / always-tile
 * classes). Gaps and sizing constants are below; edit them, then turn the script
 * off and on. "Reload Settings" (unbound) re-reads the settings page.
 */

// --------------------------------------------------
// Settings (edit here)
// --------------------------------------------------

const INNER_GAP = 8;             // px between windows
const OUTER_GAP = 8;             // px around the screen edge
const SHOW_MESSAGES = true;      // short on-screen message after changes
const SMART_SIZING = true;       // start with smart sizing on

// Windows of these classes are never tiled (case-insensitive).
const IGNORED_CLASSES = [
    "plasmashell",
    "krunner",
    "xdg-desktop-portal-kde",
    "org.kde.polkit-kde-authentication-agent-1"
];

// KWin's own windows (tooltips on the title-bar buttons and the like).
const KWIN_CLASSES = ["kwin", "kwin_wayland", "kwin_x11", "org.kde.kwin"];

/*
 * How much room a kind of window likes, relative to 1.0. A window matches
 * when its class or name CONTAINS one of the words. First match wins.
 */
const CATEGORY_WEIGHTS = [
    { weight: 1.5, match: ["code", "vscodium", "jetbrains", "idea", "pycharm", "clion", "webstorm",
                           "goland", "rider", "android-studio", "kate", "kwrite", "sublime", "emacs",
                           "neovide", "qtcreator", "kdevelop", "dev.zed"] },
    { weight: 1.4, match: ["firefox", "chrome", "chromium", "brave", "vivaldi", "opera", "librewolf",
                           "falkon", "konqueror", "floorp", "waterfox", "zen-browser", "microsoft-edge"] },
    { weight: 1.3, match: ["libreoffice", "onlyoffice", "okular", "evince", "zathura", "calibre",
                           "krita", "gimp", "inkscape", "blender", "kdenlive", "vlc", "mpv", "haruna",
                           "celluloid", "totem", "obsidian"] },
    { weight: 0.8, match: ["konsole", "kitty", "alacritty", "foot", "wezterm", "xterm", "yakuake",
                           "terminator", "gnome-terminal", "tilix", "ghostty", "urxvt", "ptyxis"] },
    { weight: 0.7, match: ["discord", "telegram", "signal", "slack", "element", "whatsapp", "zulip",
                           "spotify", "elisa", "amarok", "rhythmbox", "strawberry", "kcalc",
                           "calculator", "pavucontrol", "keepassxc", "bitwarden", "kwalletmanager"] }
];

let MAX_TILED = 5;               // windows beyond this many per screen/desktop float (settings page can change it)
const BASE_MAX_TILED = MAX_TILED;
const OVERFLOW_CASCADE = 32;     // px offset between stacked floating windows

/*
 * Apps that open floating (exact class or name, case-insensitive), by
 * category. Every category can be switched off in the script's settings page;
 * floating apps don't count toward MAX_TILED. Experiment with Meta+Ctrl+F and
 * add the class names it prints to FLOAT_CLASSES (or to the settings page).
 */
const FLOAT_GROUPS = {
    // ---- file managers
    fileManagers: [
        "org.kde.dolphin", "dolphin", "org.gnome.nautilus", "nautilus", "thunar",
        "nemo", "pcmanfm-qt", "pcmanfm", "krusader", "doublecmd", "caja", "spacefm"
    ],

    // ---- terminals
    terminals: [
        "org.kde.konsole", "konsole"
    ],

    // ---- settings and system tools
    systemTools: [
        "systemsettings", "org.kde.systemsettings", "kcmshell6", "org.kde.kinfocenter", "kinfocenter",
        "org.kde.plasma-systemmonitor", "plasma-systemmonitor", "ksysguard", "org.gnome.systemmonitor",
        "gnome-system-monitor", "io.missioncenter.missioncenter", "net.nokyan.resources",
        "org.gnome.settings", "gnome-control-center", "org.gnome.tweaks", "ca.desrt.dconf-editor",
        "xfce4-settings-manager", "lxqt-config", "lxappearance", "qt5ct", "qt6ct", "kvantummanager",
        "nwg-look", "arandr", "org.kde.kmenuedit", "kmenuedit", "org.kde.plasma-welcome",
        "org.kde.drkonqi", "drkonqi-coredump-gui", "org.kde.khelpcenter", "khelpcenter", "yelp", "org.gnome.yelp",
        "org.kde.partitionmanager", "partitionmanager", "gparted", "gnome-disks", "org.gnome.baobab", "baobab",
        "org.kde.filelight", "filelight", "timeshift-gtk", "bleachbit", "org.kde.k3b", "k3b"
    ],

    // ---- software centres and package managers
    softwareCentres: [
        "org.kde.discover", "plasma-discover", "org.gnome.software", "gnome-software", "pamac-manager",
        "synaptic", "octopi", "org.kde.apper"
    ],

    // ---- network, bluetooth, audio and device panels
    devicePanels: [
        "pavucontrol", "pavucontrol-qt", "easyeffects", "com.github.wwmm.easyeffects", "org.pipewire.helvum",
        "org.rncbc.qpwgraph", "blueman-manager", "org.kde.bluedevilwizard", "bluedevil-wizard",
        "nm-connection-editor", "system-config-printer", "org.kde.kdeconnect.app", "kdeconnect-app",
        "org.kde.kdeconnect.sms", "org.kde.kamoso", "kamoso", "org.gnome.cheese", "cheese"
    ],

    // ---- music players
    musicPlayers: [
        "org.kde.elisa", "elisa", "amarok", "org.kde.amarok", "rhythmbox", "org.gnome.rhythmbox3",
        "strawberry", "clementine", "audacious", "deadbeef", "lollypop", "org.gnome.lollypop", "cantata",
        "quodlibet", "io.github.quodlibet.quodlibet", "tauonmb", "sayonara", "spotify", "spotify-qt",
        "dev.alextren.spot", "tidal-hifi", "plexamp", "feishin", "org.gnome.music", "parole",
        "org.kde.kasts", "kasts", "org.gnome.podcasts"
    ],

    // ---- video players
    videoPlayers: [
        "vlc", "mpv", "org.kde.haruna", "haruna", "io.github.celluloid_player.celluloid", "celluloid",
        "org.gnome.totem", "totem", "org.gnome.showtime", "smplayer", "org.kde.dragonplayer", "dragonplayer"
    ],

    // ---- quick text openers (not IDEs: those tile)
    textOpeners: [
        "org.kde.kate", "kate", "org.kde.kwrite", "kwrite", "gedit", "org.gnome.gedit",
        "org.gnome.texteditor", "mousepad", "featherpad", "leafpad", "pluma", "xed",
        "notepadqq", "l3afpad", "geany"
    ],

    // ---- photo viewers and camera tools
    photoViewers: [
        "org.kde.gwenview", "gwenview", "eog", "org.gnome.eog", "org.gnome.loupe", "loupe",
        "ristretto", "org.xfce.ristretto", "nomacs", "qimgv", "viewnior", "lximage-qt",
        "feh", "imv", "sxiv", "nsxiv", "geeqie", "photoqt", "shotwell"
    ],

    // ---- screenshots, pickers, clipboard
    quickTools: [
        "org.kde.spectacle", "spectacle", "flameshot", "org.flameshot.flameshot", "gnome-screenshot",
        "org.gnome.screenshot", "org.kde.kcolorchooser", "kcolorchooser", "gpick", "org.kde.kcharselect",
        "kcharselect", "gucharmap", "org.gnome.characters", "org.kde.plasma.emojier", "org.kde.kfontview",
        "kfontview", "copyq", "com.github.hluk.copyq"
    ],

    // ---- calculators
    calculators: [
        "org.kde.kcalc", "kcalc", "org.gnome.calculator", "gnome-calculator", "qalculate-gtk",
        "qalculate-qt", "io.github.qalculate.qalculate-qt", "speedcrunch", "galculator", "mate-calc"
    ],

    // ---- passwords, keys and certificates
    passwordTools: [
        "org.keepassxc.keepassxc", "keepassxc", "bitwarden", "org.kde.kwalletmanager",
        "org.kde.kwalletmanager5", "kwalletmanager", "kwalletmanager5", "org.gnome.seahorse.application",
        "seahorse", "org.kde.kleopatra", "kleopatra"
    ],

    // ---- archives and downloads
    archivesDownloads: [
        "org.kde.ark", "ark", "org.gnome.fileroller", "file-roller", "engrampa", "xarchiver", "peazip",
        "org.qbittorrent.qbittorrent", "qbittorrent", "org.kde.ktorrent", "ktorrent", "transmission-gtk",
        "transmission-qt", "deluge", "de.haeckerfelix.fragments", "org.kde.kget", "kget"
    ]
};

const FLOAT_CLASSES = [];        // your own extra classes that always float

const DEBUG_LOG = false;         // start with the debug log on (Meta+Ctrl+Shift+D toggles)

const MASTER_BONUS = 1.6;        // extra weight of the master when 3+ windows are open
const AUTO_MIN = 0.25;           // smart sizing never gives a split less than this ...
const AUTO_MAX = 0.75;           // ... or more than this
const AXIS_OVERRIDE = 1.3;       // region this much longer than wide (or wider than long) flips the split

const DEFAULT_RATIO = 0.5;       // used when smart sizing is off
const RATIO_STEP = 0.05;
const MIN_RATIO = 0.15;          // limits for sizes set by hand
const MAX_RATIO = 0.85;

// --------------------------------------------------
// State
// --------------------------------------------------

let windows = [];            // tiling order (never reordered automatically)
let floatingWindows = [];
let suspendedWindows = [];   // maximized
let trackedWindows = [];     // signals connected
let pendingRestore = [];     // un-maximized, waiting for geometry to settle
let movingWindow = null;
let moveKind = null;         // "move" | "resize"
let arranging = false;
let dirty = false;
let gapsOn = true;
let smartOn = SMART_SIZING;
let lastFocused = null;      // last tileable window that had focus
let debugOn = DEBUG_LOG;
let ready = false;           // false while the script is starting up

const floatClassSet = new Set();   // filled by applySettings()
const observedMin = new Map(); // window -> size it showed it cannot shrink below
const fixTries = new Map();   // window -> { sig, n }: re-apply attempts for one assigned rect
const overlaySet = new Set();  // tiny windows at first sight: tooltips and the like
const overflowSet = new Set(); // windows floating only because of MAX_TILED

const manual = {};           // layoutKey -> { splitIndex: ratio } set by the user
const splitInfo = {};        // layoutKey -> splits from the last layout pass
const mirrored = {};         // layoutKey -> true
const placed = new Map();    // window -> rect we last assigned
const openShare = new Map(); // window -> share of the screen it asked for on opening

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function contains(list, win) {
    return list.indexOf(win) !== -1;
}

function removeFromList(list, win) {
    const index = list.indexOf(win);

    if (index !== -1)
        list.splice(index, 1);
}

function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

/* Everything that tells a real window from a tooltip, for the debug log. */
function describeFlags(win) {
    const flags = ["normalWindow", "tooltip", "popupWindow", "popupMenu", "dropdownMenu", "comboBox",
                   "appletPopup", "notification", "onScreenDisplay", "outline", "splash", "toolbar",
                   "menu", "dock", "dialog", "transient", "skipTaskbar", "skipSwitcher", "wantsInput",
                   "resizeable", "specialWindow", "inputMethod"];

    return "class=" + win.resourceClass + " name=" + win.resourceName
        + " desktopFile=" + win.desktopFileName + " pid=" + win.pid
        + " windowType=" + win.windowType + " "
        + flags.map(function (f) { return f + "=" + win[f]; }).join(" ");
}

function dbg(message) {
    if (debugOn)
        print("Alternating Tile [debug]: " + message);
}

// --------------------------------------------------
// Settings page (System Settings > Window Management > KWin Scripts > Configure)
// --------------------------------------------------

const GROUP_LABELS = {
    fileManagers: "file managers", terminals: "terminals", systemTools: "settings and system tools",
    softwareCentres: "software centres", devicePanels: "audio, network and device panels",
    musicPlayers: "music players", videoPlayers: "video players", textOpeners: "quick text openers",
    photoViewers: "photo viewers", quickTools: "screenshot and picker tools", calculators: "calculators",
    passwordTools: "password and key managers", archivesDownloads: "archive and download tools"
};

let settingsSig = "";

function readSetting(key, fallback) {
    try {
        if (typeof readConfig === "function") {
            const v = readConfig(key, fallback);

            if (v !== undefined && v !== null)
                return v;
        }
    } catch (error) {
        // no settings available: use the defaults
    }

    return fallback;
}

function readBool(key, fallback) {
    const v = readSetting(key, fallback);

    return !(v === false || v === "false" || v === 0 || v === "0");
}

function readList(key) {
    return String(readSetting(key, "")).toLowerCase().split(/[\s,;]+/).filter(function (x) { return x !== ""; });
}

/*
 * Reads the settings page and rebuilds what floats. Returns true when
 * something changed. Called at start, whenever a window appears (so a saved
 * change reaches the next window without restarting) and by "Reload Settings".
 * A change discards the session's Meta+Ctrl+F experiments.
 */
function applySettings() {
    const groups = {};
    const set = new Set();

    for (const key of Object.keys(FLOAT_GROUPS)) {
        const on = readBool("float" + key.charAt(0).toUpperCase() + key.slice(1), true);

        groups[key] = on;

        if (on)
            FLOAT_GROUPS[key].forEach(function (c) { set.add(String(c).toLowerCase()); });
    }

    FLOAT_CLASSES.forEach(function (c) { set.add(String(c).toLowerCase()); });

    const extra = readList("floatExtra");
    const never = readList("alwaysTile");
    const maxTiled = clamp(parseInt(readSetting("maxTiled", BASE_MAX_TILED), 10) || BASE_MAX_TILED, 1, 12);

    extra.forEach(function (c) { set.add(c); });
    never.forEach(function (c) { set.delete(c); });

    const sig = JSON.stringify([groups, extra, never, maxTiled]);

    if (sig === settingsSig)
        return false;

    settingsSig = sig;
    floatClassSet.clear();
    set.forEach(function (c) { floatClassSet.add(c); });
    MAX_TILED = maxTiled;
    print("Alternating Tile: settings applied: max " + MAX_TILED + " tiled, floating categories: "
          + Object.keys(groups).filter(function (k) { return groups[k]; }).join(",")
          + (extra.length ? ", extra float: " + extra.join(",") : "")
          + (never.length ? ", always tile: " + never.join(",") : ""));
    return true;
}

function appKey(win) {
    return String(win.resourceClass || win.resourceName || "").toLowerCase();
}

function matchesFloatClass(win) {
    const cls = String(win.resourceClass || "").toLowerCase();
    const name = String(win.resourceName || "").toLowerCase();

    return floatClassSet.has(cls) || (name !== "" && floatClassSet.has(name));
}

function isKWinWindow(win) {
    const cls = String(win.resourceClass || "").toLowerCase();
    const name = String(win.resourceName || "").toLowerCase();

    return KWIN_CLASSES.indexOf(cls) !== -1 || KWIN_CLASSES.indexOf(name) !== -1;
}

function isIgnored(win) {
    const cls = String(win.resourceClass || "").toLowerCase();
    const name = String(win.resourceName || "").toLowerCase();

    return IGNORED_CLASSES.indexOf(cls) !== -1
        || (name !== "" && IGNORED_CLASSES.indexOf(name) !== -1);
}

/* Why a window is not a tiling candidate ("" if it is one). */
function whyNot(win) {
    if (!win)                     return "no window";
    if (win.deleted)              return "deleted";
    if (!win.normalWindow)        return "not a normal window";

    // KWin's own tooltips (the label shown when you hover the close/minimize/
    // maximize buttons), popups and overlays can report themselves as normal
    // windows. Only KWin's definitive window-TYPE flags are used here: flags
    // like wantsInput or skipTaskbar are not reliable on real windows.
    if (win.tooltip || win.popupWindow || win.popupMenu || win.dropdownMenu
        || win.comboBox || win.appletPopup || win.notification
        || win.criticalNotification || win.onScreenDisplay || win.dndIcon
        || win.splash || win.dock || win.desktopWindow || win.inputMethod)
        return "tooltip, popup or overlay";
    if (win.outline)              return "outline (drag preview)";

    // Judged once, when the window appeared (see addWindow).
    if (overlaySet.has(win))      return "tooltip, popup or overlay (tiny when it appeared)";

    if (isKWinWindow(win))        return "KWin's own window";
    if (win.specialWindow)        return "special window";
    if (win.transient)            return "transient (belongs to another window)";
    if (win.dialog)               return "dialog";
    if (win.resizeable === false) return "fixed size";
    if (isIgnored(win))           return "class is on the ignore list";

    return "";
}

function isCandidate(win) {
    return whyNot(win) === "";
}

function isTileable(win) {
    return isCandidate(win)
        && !win.minimized
        && !win.fullScreen
        && !contains(floatingWindows, win)
        && !contains(suspendedWindows, win);
}

function onCurrentDesktop(win) {
    if (win.onAllDesktops)
        return true;

    const current = workspace.currentDesktop;

    return win.desktops.some(function (d) {
        return d === current || (d.id !== undefined && d.id === current.id);
    });
}

function layoutKey(screen) {
    const d = workspace.currentDesktop;
    return String(screen.name) + ":" + String(d && d.id !== undefined ? d.id : d);
}

/*
 * The window actions apply to. When something that isn't a tiling candidate
 * has focus (a panel popup, the controls widget, KRunner), fall back to the
 * last tileable window that had it.
 */
function focusedWindow() {
    const a = workspace.activeWindow;

    if (a && isCandidate(a))
        return a;

    return (lastFocused && isCandidate(lastFocused)) ? lastFocused : null;
}

function currentScreen() {
    const win = focusedWindow();

    return (win && win.output) ? win.output : workspace.screens[0];
}

/* Everything that wants a tile on this screen/desktop, in tiling order. */
function candidatesOn(screen) {
    return windows.filter(function (win) {
        return isTileable(win)
            && onCurrentDesktop(win)
            && win.output === screen;
    });
}

/* The windows that actually get a tile: the first MAX_TILED. */
function tiledOn(screen) {
    return candidatesOn(screen).slice(0, MAX_TILED);
}

function gapIn() {
    return gapsOn ? INNER_GAP : 0;
}

function gapOut() {
    return gapsOn ? OUTER_GAP : 0;
}

/* Short on-screen message (Plasma's OSD). Silently skipped if unavailable. */
function osd(text) {
    if (!SHOW_MESSAGES)
        return;

    try {
        callDBus("org.kde.plasmashell", "/org/kde/osdService",
                 "org.kde.osdService", "showText", "view-grid", text);
    } catch (error) {
        // no OSD service: not important
    }
}

function percent(ratio) {
    return Math.round(ratio * 100) + "%";
}

// --------------------------------------------------
// Sizes set by the user (override smart sizing)
// --------------------------------------------------

function manualRatio(key, k) {
    return manual[key] ? manual[key][k] : undefined;
}

function setManual(key, k, value) {
    if (!manual[key])
        manual[key] = {};

    manual[key][k] = clamp(value, MIN_RATIO, MAX_RATIO);
}

/* The ratio of split k as last laid out (user's or smart). */
function effectiveRatio(key, k) {
    const info = splitInfo[key];

    if (info && info.splits[k])
        return info.splits[k].ratio;

    return DEFAULT_RATIO;
}

/* Axis of split k as last laid out ("V" side by side, "H" stacked). */
function axisOfSplit(key, k) {
    const info = splitInfo[key];

    if (info && info.splits[k])
        return info.splits[k].axis;

    return (k % 2 === 0) ? "V" : "H";
}

// --------------------------------------------------
// Smart sizing
// --------------------------------------------------

function categoryWeight(win) {
    const cls = String(win.resourceClass || "").toLowerCase();
    const name = String(win.resourceName || "").toLowerCase();

    for (const rule of CATEGORY_WEIGHTS) {
        for (const word of rule.match) {
            if (cls.indexOf(word) !== -1 || name.indexOf(word) !== -1)
                return rule.weight;
        }
    }

    return 1;
}

/*
 * A window that opened big wants room; one that opened small doesn't.
 * Only known for windows that appeared after the script started.
 */
function sizeFactor(win) {
    const share = openShare.get(win);

    if (share === undefined)
        return 1;

    return clamp(Math.pow(Math.max(share, 0.01) / 0.35, 0.35), 0.75, 1.3);
}

function weightOf(win) {
    return categoryWeight(win) * sizeFactor(win);
}

function rememberOpenSize(win) {
    try {
        const g = win.frameGeometry;

        if (!win.output || g.width < 150 || g.height < 100)
            return;

        const area = workspace.clientArea(
            KWin.MaximizeArea, win.output, workspace.currentDesktop);

        openShare.set(win, (g.width * g.height) / Math.max(1, area.width * area.height));
    } catch (error) {
        // no information: the window is simply weighted by its kind
    }
}

/*
 * Minimum along an axis: what the window declares, or what it showed it
 * cannot shrink below. Capped so a silly value can't dominate.
 */
function minAlong(win, axis, extent) {
    const m = win.minSize;
    const o = observedMin.get(win);
    let declared = 0;
    let seen = 0;

    if (m && isFinite(axis === "V" ? m.width : m.height))
        declared = axis === "V" ? m.width : m.height;

    if (o)
        seen = axis === "V" ? o.width : o.height;

    // A declared minimum may be silly (capped at 60%); a size the window
    // actually showed it needs is real (capped at 85%).
    return Math.max(Math.min(Math.max(declared, 0), extent * 0.6),
                    Math.min(Math.max(seen, 0), extent * 0.85));
}

/* Largest minimum among windows list[from..] along an axis. */
function maxMinAlong(list, from, axis, extent) {
    let best = 0;

    for (let j = from; j < list.length; ++j)
        best = Math.max(best, minAlong(list[j], axis, extent));

    return best;
}

/*
 * Moves ratio r so both sides of split k have room for their minimum
 * sizes where possible. Used for smart, manual and default sizes alike.
 */
function fitMinimums(r, list, k, axis, extent, avail) {
    const needFirst = minAlong(list[k], axis, extent);
    const needRest = maxMinAlong(list, k + 1, axis, extent);

    if (needFirst <= 0 && needRest <= 0)
        return r;

    const lo = needFirst / avail;
    const hi = 1 - needRest / avail;

    return (lo > hi) ? needFirst / (needFirst + needRest) : clamp(r, lo, hi);
}

/*
 * Share of split k for the first window, from the weights of the windows
 * on each side. Because each "first" window spans the whole other
 * dimension of its region, this gives every window area ~ its weight.
 */
function smartRatio(list, weights, k, axis, extent, avail) {
    let rest = 0;

    for (let j = k + 1; j < list.length; ++j)
        rest += weights[j];

    let r = clamp(weights[k] / (weights[k] + rest), AUTO_MIN, AUTO_MAX);

    return r;
}

// --------------------------------------------------
// Geometry
// --------------------------------------------------

function setGeometry(win, rect) {
    const r = {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height))
    };

    placed.set(win, r);

    const g = win.frameGeometry;

    if (g.x === r.x && g.y === r.y
        && g.width === r.width && g.height === r.height)
        return;

    dbg("move \"" + win.caption + "\" -> " + r.x + "," + r.y + " " + r.width + "x" + r.height);
    win.frameGeometry = r;
}

/*
 * Axis for the next split. Normally the opposite of the previous one; but
 * if the region is much longer than wide (or wider than long) the other
 * axis gives better-shaped windows, so use that.
 */
function chooseAxis(previous, region) {
    const strict = (previous === "V") ? "H" : "V";

    if (strict === "V" && region.height > region.width * AXIS_OVERRIDE)
        return "H";

    if (strict === "H" && region.width > region.height * AXIS_OVERRIDE)
        return "V";

    return strict;
}

/*
 * Window list[k] takes the "first" part of split k; the remaining windows
 * share the "second" part, which is split again. Returns the rects and the
 * split description (axis, size, ratio) used by the size shortcuts.
 */
function layoutAlternating(list, rect, key) {
    const gap = gapIn();
    const n = list.length;
    const weights = list.map(function (win) { return smartOn ? weightOf(win) : 1; });

    if (smartOn && n >= 3)
        weights[0] *= MASTER_BONUS;

    const rects = [];
    const splits = [];
    let cur = rect;
    let previous = "H";             // so the first split is side by side

    for (let k = 0; k < n - 1; ++k) {
        const axis = chooseAxis(previous, cur);
        const extent = (axis === "V") ? cur.width : cur.height;
        const avail = Math.max(2, extent - gap);
        const user = manualRatio(key, k);
        let ratio;

        if (user !== undefined)
            ratio = user;
        else if (smartOn)
            ratio = smartRatio(list, weights, k, axis, extent, avail);
        else
            ratio = DEFAULT_RATIO;

        ratio = fitMinimums(clamp(ratio, MIN_RATIO, MAX_RATIO), list, k, axis, extent, avail);
        ratio = clamp(ratio, 0.05, 0.95);

        const size = clamp(Math.round(avail * ratio), 1, avail - 1);
        let first, second;

        if (axis === "V") {
            first = { x: cur.x, y: cur.y, width: size, height: cur.height };
            second = {
                x: cur.x + size + gap,
                y: cur.y,
                width: Math.max(1, cur.width - size - gap),
                height: cur.height
            };
        } else {
            first = { x: cur.x, y: cur.y, width: cur.width, height: size };
            second = {
                x: cur.x,
                y: cur.y + size + gap,
                width: cur.width,
                height: Math.max(1, cur.height - size - gap)
            };
        }

        rects.push(first);
        splits.push({ axis: axis, avail: avail, ratio: ratio, start: (axis === "V") ? cur.x : cur.y, gap: gap });
        cur = second;
        previous = axis;
    }

    if (n > 0)
        rects.push(cur);

    return { rects: rects, info: { splits: splits, rect: rect } };
}

function computeLayout(list, rect, key) {
    const layout = layoutAlternating(list, rect, key);

    if (mirrored[key]) {
        layout.rects = layout.rects.map(function (r) {
            return {
                x: 2 * rect.x + rect.width - r.x - r.width,
                y: r.y,
                width: r.width,
                height: r.height
            };
        });
    }

    return layout;
}

// --------------------------------------------------
// Reflow (re-entrancy safe: requests during a pass trigger another pass)
// --------------------------------------------------

function arrangePass() {
    const newlyFloating = [];

    for (const screen of workspace.screens) {
        const all = candidatesOn(screen);
        const list = all.slice(0, MAX_TILED);
        const extra = all.slice(MAX_TILED);
        const key = layoutKey(screen);

        // Windows beyond the limit float; windows that made it into the
        // limit are tiled again.
        list.forEach(function (win) { overflowSet.delete(win); });

        extra.forEach(function (win, i) {
            placed.delete(win);

            if (!overflowSet.has(win)) {
                overflowSet.add(win);
                newlyFloating.push(win);
                centerOnScreen(win, i * OVERFLOW_CASCADE);
                raiseOnly(win);
            }
        });

        if (list.length === 0) {
            delete splitInfo[key];
            continue;
        }

        const area = workspace.clientArea(
            KWin.MaximizeArea,
            screen,
            workspace.currentDesktop
        );

        const outer = list.length > 1 ? gapOut() : 0;

        const layout = computeLayout(list, {
            x: area.x + outer,
            y: area.y + outer,
            width: Math.max(1, area.width - outer * 2),
            height: Math.max(1, area.height - outer * 2)
        }, key);

        for (let i = 0; i < list.length; ++i)
            setGeometry(list[i], layout.rects[i]);

        splitInfo[key] = layout.info;
    }

    if (ready && newlyFloating.length > 0) {
        osd(newlyFloating.length === 1
            ? "\"" + newlyFloating[0].caption + "\" floats (max " + MAX_TILED + " tiled)"
            : newlyFloating.length + " windows float (max " + MAX_TILED + " tiled)");
    }
}

function arrange() {
    // Reflow is deferred while the user drags; finishing the drag calls us.
    if (movingWindow)
        return;

    if (arranging) {
        dirty = true;
        return;
    }

    arranging = true;
    dbg("arrange");

    try {
        let passes = 0;

        do {
            dirty = false;
            arrangePass();
        } while (dirty && ++passes < 3);
    } catch (error) {
        print("Alternating Master Stack error: " + error);
    } finally {
        arranging = false;
        dirty = false;
    }
}

// --------------------------------------------------
// Floating
// --------------------------------------------------

function raiseOnly(win) {
    if (typeof workspace.raiseWindow === "function")
        workspace.raiseWindow(win);
}

function raiseAndFocus(win) {
    raiseOnly(win);
    workspace.activeWindow = win;
}

/*
 * Centre a window on its screen's work area (plus an optional offset, for
 * cascading). Keeps its size, unless it is nearly screen-sized, in which
 * case it is shrunk so it reads as floating.
 */
function centerOnScreen(win, offset) {
    const area = workspace.clientArea(
        KWin.MaximizeArea, win.output, workspace.currentDesktop);
    const g = win.frameGeometry;
    const shift = offset || 0;

    function fit(size, avail) {
        return Math.min(avail, size > avail * 0.9 ? Math.round(avail * 0.7) : size);
    }

    const w = fit(g.width, area.width);
    const h = fit(g.height, area.height);

    placed.delete(win);
    dbg("float-place \"" + win.caption + "\"");

    win.frameGeometry = {
        x: Math.round(clamp(area.x + (area.width - w) / 2 + shift, area.x, area.x + area.width - w)),
        y: Math.round(clamp(area.y + (area.height - h) / 2 + shift, area.y, area.y + area.height - h)),
        width: w,
        height: h
    };
}

/* Put a floating window at a given rectangle, kept inside its screen. */
function sendFloatTo(win, rect) {
    const area = workspace.clientArea(
        KWin.MaximizeArea, win.output, workspace.currentDesktop);
    const w = Math.min(rect.width, area.width);
    const h = Math.min(rect.height, area.height);

    placed.delete(win);

    win.frameGeometry = {
        x: Math.round(clamp(rect.x, area.x, area.x + area.width - w)),
        y: Math.round(clamp(rect.y, area.y, area.y + area.height - h)),
        width: w,
        height: h
    };

    raiseOnly(win);
}

function isFloatingNow(win) {
    return contains(floatingWindows, win) || overflowSet.has(win);
}

/*
 * Float: leave the layout, move to the centre of the screen, raise.
 * Unfloat: rejoin the layout (at the end; it floats again if there is no
 * room). A window that floats only because of the limit swaps with the last
 * tile instead.
 */
function toggleFloating() {
    const win = focusedWindow();

    if (!win || contains(suspendedWindows, win))
        return;

    if (contains(floatingWindows, win)) {
        removeFromList(floatingWindows, win);

        if (!contains(windows, win))
            windows.push(win);

        arrange();
        osd(overflowSet.has(win)
            ? "No room to tile (max " + MAX_TILED + "): stays floating"
            : "Tiled");
    } else if (overflowSet.has(win)) {
        const list = tiledOn(win.output);
        const last = list[list.length - 1];

        if (!last)
            return;

        swapWindows(win, last);
        arrange();
        raiseAndFocus(win);
        osd("\"" + last.caption + "\" floats instead");
    } else {
        removeFromList(windows, win);
        floatingWindows.push(win);

        arrange();            // the others take the freed space
        centerOnScreen(win);
        raiseAndFocus(win);
        osd("Floating");
    }
}

/*
 * Make every window of the focused window's app always open floating (or
 * tile again), for this session. For experimenting; to keep the change, add
 * the class name that is printed to FLOAT_CLASSES at the top of the script.
 */
function toggleAppFloat() {
    const win = focusedWindow();

    if (!win)
        return;

    const key = appKey(win);

    if (key === "")
        return;

    const same = workspace.stackingOrder.filter(function (w) {
        return w && isCandidate(w) && appKey(w) === key;
    });

    if (floatClassSet.has(key) || matchesFloatClass(win)) {
        // Remove every spelling that made this app float (class and name).
        for (const w of same) {
            floatClassSet.delete(appKey(w));
            floatClassSet.delete(String(w.resourceName || "").toLowerCase());
        }

        floatClassSet.delete(key);

        for (const w of same) {
            if (contains(floatingWindows, w)) {
                removeFromList(floatingWindows, w);

                if (!contains(windows, w))
                    windows.push(w);
            }
        }

        arrange();
        print("Alternating Tile: \"" + key + "\" tiles again (to keep this, add it to \"Always tile\" in the settings page)");
        osd("\"" + key + "\" tiles again");
    } else {
        floatClassSet.add(key);

        for (const w of same) {
            if (!contains(floatingWindows, w) && !contains(suspendedWindows, w)) {
                removeFromList(windows, w);
                floatingWindows.push(w);
            }
        }

        arrange();

        for (const w of same) {
            if (contains(floatingWindows, w))
                centerOnScreen(w);
        }

        raiseAndFocus(win);
        print("Alternating Tile: \"" + key + "\" now always floats. To keep this, add \""
              + key + "\" to \"Always float\" in the settings page");
        osd("\"" + key + "\" now always floats");
    }
}

// --------------------------------------------------
// Keyboard: focus / swap / promote
// --------------------------------------------------

function center(g) {
    return { x: g.x + g.width / 2, y: g.y + g.height / 2 };
}

function neighbour(win, dir) {
    const g = win.frameGeometry;
    const c = center(g);
    const horizontal = (dir === "left" || dir === "right");
    let best = null;
    let bestScore = Infinity;

    for (const cand of tiledOn(win.output)) {
        if (cand === win)
            continue;

        const cg = cand.frameGeometry;
        const cc = center(cg);
        let along;

        if (dir === "left")       along = c.x - cc.x;
        else if (dir === "right") along = cc.x - c.x;
        else if (dir === "up")    along = c.y - cc.y;
        else                      along = cc.y - c.y;

        if (along <= 0)
            continue;

        const perp = horizontal ? Math.abs(c.y - cc.y) : Math.abs(c.x - cc.x);
        const overlaps = horizontal
            ? (cg.y < g.y + g.height && cg.y + cg.height > g.y)
            : (cg.x < g.x + g.width && cg.x + cg.width > g.x);

        // Prefer windows that share an edge range, then the closest.
        const score = along + perp * 2 + (overlaps ? 0 : 100000);

        if (score < bestScore) {
            bestScore = score;
            best = cand;
        }
    }

    return best;
}

function activeTiled() {
    const win = focusedWindow();

    if (!win || !contains(windows, win) || !isTileable(win))
        return null;

    return contains(tiledOn(win.output), win) ? win : null;
}

function focusDirection(dir) {
    const win = activeTiled();

    if (!win)
        return;

    const target = neighbour(win, dir);

    if (target)
        raiseAndFocus(target);
}

function cycleFocus(step) {
    const list = tiledOn(currentScreen());

    if (list.length === 0)
        return;

    const i = list.indexOf(focusedWindow());

    raiseAndFocus(i < 0 ? list[0] : list[(i + step + list.length) % list.length]);
}

function swapWindows(a, b) {
    const i = windows.indexOf(a);
    const j = windows.indexOf(b);

    if (i < 0 || j < 0 || i === j)
        return;

    windows[i] = b;
    windows[j] = a;
}

function swapDirection(dir) {
    const win = activeTiled();

    if (!win)
        return;

    const target = neighbour(win, dir);

    if (target) {
        swapWindows(win, target);
        arrange();
    }
}

function promoteToMaster() {
    const win = activeTiled();

    if (!win)
        return;

    const list = tiledOn(win.output);

    if (list.length < 2)
        return;

    if (list[0] === win) {
        // Already master: swap with the next one (like dwm's zoom).
        swapWindows(win, list[1]);
    } else {
        removeFromList(windows, win);
        windows.unshift(win);
    }

    arrange();
}

// --------------------------------------------------
// Controls: rotate, mirror, gaps, smart sizing
// --------------------------------------------------

function mirrorLayout() {
    const key = layoutKey(currentScreen());

    mirrored[key] = !mirrored[key];
    arrange();
    osd(mirrored[key] ? "Mirrored" : "Not mirrored");
}

function rotateWindows(direction) {
    const list = tiledOn(currentScreen());
    const n = list.length;

    if (n < 2)
        return;

    const slots = list.map(function (w) { return windows.indexOf(w); });
    const rotated = direction > 0
        ? [list[n - 1]].concat(list.slice(0, n - 1))
        : list.slice(1).concat([list[0]]);

    for (let i = 0; i < n; ++i)
        windows[slots[i]] = rotated[i];

    arrange();
    osd(direction > 0 ? "Rotated forward" : "Rotated backward");
}

function toggleGaps() {
    gapsOn = !gapsOn;
    print("Alternating Tile: gaps " + (gapsOn ? "on" : "off"));
    arrange();
    osd(gapsOn ? "Gaps on" : "Gaps off");
}

function toggleSmart() {
    smartOn = !smartOn;
    print("Alternating Tile: smart sizing " + (smartOn ? "on" : "off"));
    arrange();
    osd(smartOn ? "Smart sizing on" : "Smart sizing off");
}

// --------------------------------------------------
// Sizes by hand
// --------------------------------------------------

/*
 * Window i is the "first" part of split i (if it exists) and lies on the
 * "second" side of every earlier split. To grow it along an axis, move the
 * nearest split on that axis: its own (first part gets more) or the closest
 * earlier one (first part gets less).
 */
function adjustRatio(axis, delta) {
    const win = activeTiled();

    if (!win)
        return;

    observedMin.clear();

    const list = tiledOn(win.output);
    const i = list.indexOf(win);
    const key = layoutKey(win.output);

    for (let k = Math.min(i, list.length - 2); k >= 0; --k) {
        if (axisOfSplit(key, k) !== axis)
            continue;

        const sign = (k === i) ? 1 : -1;

        setManual(key, k, effectiveRatio(key, k) + sign * delta);
        arrange();

        const r = effectiveRatio(key, k);

        osd((axis === "V" ? "Width: " : "Height: ") + percent(k === i ? r : 1 - r));
        return;
    }
}

/*
 * Give the focused window an exact share of the split it sits in:
 * "Share 60" makes it take 60% (its sibling gets 40%).
 */
function setShare(pct) {
    const win = activeTiled();

    if (!win)
        return;

    observedMin.clear();

    const list = tiledOn(win.output);
    const n = list.length;
    const i = list.indexOf(win);
    const key = layoutKey(win.output);
    const p = clamp(pct / 100, MIN_RATIO, MAX_RATIO);

    if (n < 2)
        return;

    if (i <= n - 2)
        setManual(key, i, p);
    else
        setManual(key, i - 1, 1 - p);

    arrange();
    osd("Window share: " + percent(p));
}

function resetRatios() {
    observedMin.clear();
    delete manual[layoutKey(currentScreen())];
    arrange();
    osd(smartOn ? "Sizes reset (smart sizing)" : "Sizes reset to " + percent(DEFAULT_RATIO));
}

/*
 * Convert the user's mouse resize into new sizes. What counts is WHICH EDGE
 * the user moved, not which window it was:
 *  - the end edge (right/bottom) of window i is the boundary of its own split
 *    i, if that split runs along this axis (otherwise it is the screen edge);
 *  - the start edge (left/top) is the boundary of the nearest earlier split on
 *    this axis (otherwise it is the screen edge).
 * So any edge shared with a neighbour can be dragged, on any window.
 */
function applyResize(win) {
    observedMin.clear();          // the user decided: relearn only what really refuses

    const list = tiledOn(win.output);
    const n = list.length;
    const i = list.indexOf(win);
    const key = layoutKey(win.output);
    const info = splitInfo[key];
    const before = placed.get(win);

    if (i < 0 || !info || !before || info.splits.length !== n - 1)
        return;

    const splits = info.splits;
    const flip = !!mirrored[key];
    const rx = info.rect.x;
    const rw = info.rect.width;

    // Back to the unmirrored layout's coordinates.
    function unmirror(r) {
        if (!flip)
            return { x: r.x, y: r.y, width: r.width, height: r.height };

        return { x: 2 * rx + rw - r.x - r.width, y: r.y, width: r.width, height: r.height };
    }

    const now = unmirror(win.frameGeometry);
    const was = unmirror(before);

    for (const axis of ["V", "H"]) {
        const pos = (axis === "V") ? "x" : "y";
        const len = (axis === "V") ? "width" : "height";
        const dStart = now[pos] - was[pos];
        const dEnd = (now[pos] + now[len]) - (was[pos] + was[len]);

        if (Math.abs(dEnd) > 1 && i <= n - 2 && splits[i].axis === axis) {
            const s = splits[i];

            setManual(key, i, (now[pos] + now[len] - s.start) / s.avail);
        }

        if (Math.abs(dStart) > 1) {
            let owner = -1;

            for (let k = Math.min(i - 1, n - 2); k >= 0; --k) {
                if (splits[k].axis === axis) {
                    owner = k;
                    break;
                }
            }

            if (owner >= 0) {
                const s = splits[owner];

                setManual(key, owner, (now[pos] - s.gap - s.start) / s.avail);
            }
        }
    }
}

// --------------------------------------------------
// Drag-to-swap
// --------------------------------------------------

/*
 * The topmost visible window under the cursor (other than the dragged one).
 * If it is a floating window, it blocks the drop: the drop landed on it, not
 * on the tile hidden underneath.
 */
function windowAt(dragged) {
    const cursor = workspace.cursorPos;
    const order = workspace.stackingOrder;

    for (let i = order.length - 1; i >= 0; --i) {
        const cand = order[i];

        if (!cand || cand === dragged || cand.deleted || cand.minimized
            || !isCandidate(cand)
            || !onCurrentDesktop(cand)
            || cand.output !== dragged.output)
            continue;

        const g = cand.frameGeometry;

        if (cursor.x >= g.x && cursor.x < g.x + g.width
            && cursor.y >= g.y && cursor.y < g.y + g.height)
            return cand;
    }

    return null;
}

const TITLE_BAR_FALLBACK = 32;   // px, used when the window reports no decoration height

/* True when the cursor is over the window's title bar (name, close, ...). */
function overTitleBar(win) {
    const cursor = workspace.cursorPos;
    const g = win.frameGeometry;
    let h = TITLE_BAR_FALLBACK;

    if (win.clientGeometry && win.clientGeometry.y > g.y)
        h = win.clientGeometry.y - g.y;

    return cursor.x >= g.x && cursor.x < g.x + g.width
        && cursor.y >= g.y && cursor.y < g.y + h;
}

function swapByDrop(dragged) {
    if (!dragged || dragged.deleted || !contains(windows, dragged))
        return;

    const hit = windowAt(dragged);

    if (hit && contains(tiledOn(dragged.output), hit))
        swapWindows(dragged, hit);
}

/*
 * A floating window dropped on a tile joins the tiling. With room (fewer than
 * MAX_TILED tiles) it takes the target's position and the others shift along.
 * When the tiles are full it takes that tile and the replaced window floats
 * where the dragged one came from.
 */
function replaceByDrop(dragged, start) {
    if (!dragged || dragged.deleted)
        return;

    const target = windowAt(dragged);

    if (!target || !contains(tiledOn(dragged.output), target))
        return;                    // dropped on empty space or on another floating window

    // A floating window only snaps into the tiling when it is released over
    // the target's title bar, so floating windows can be moved around freely.
    if (!overTitleBar(target))
        return;

    if (!overflowSet.has(dragged) && tiledOn(dragged.output).length < MAX_TILED) {
        // There is room: the window joins the tiling in the target's place and
        // the target (and the ones after it) shift along. Nobody floats.
        removeFromList(floatingWindows, dragged);

        if (!contains(windows, dragged))
            windows.push(dragged);

        removeFromList(windows, dragged);
        windows.splice(windows.indexOf(target), 0, dragged);
        arrange();
        osd("Tiled");
        return;
    }

    if (overflowSet.has(dragged)) {
        // In the order beyond the limit: swapping order slots hands the
        // tile to the dragged window and pushes the target beyond the limit.
        swapWindows(dragged, target);
    } else {
        // Floated by you or by a class rule: it is not in the order, so the
        // replaced window floats explicitly.
        removeFromList(floatingWindows, dragged);
        windows.splice(windows.indexOf(target), 1, dragged);
        floatingWindows.push(target);
    }

    arrange();
    sendFloatTo(target, start);
    osd("\"" + target.caption + "\" floats");
}

function connectDragSwap(win) {
    let startGeometry = null;

    win.interactiveMoveResizeStarted.connect(function () {
        movingWindow = win;
        moveKind = win.resize ? "resize" : "move";

        const g = win.frameGeometry;
        startGeometry = { x: g.x, y: g.y, width: g.width, height: g.height };
    });

    win.interactiveMoveResizeFinished.connect(function () {
        if (movingWindow !== win)
            return;

        const kind = moveKind;
        const start = startGeometry;

        movingWindow = null;
        moveKind = null;
        startGeometry = null;

        if (win.deleted) {
            arrange();
            return;
        }

        if (isFloatingNow(win)) {
            const g = win.frameGeometry;

            if (kind === "move" && start && (g.x !== start.x || g.y !== start.y))
                replaceByDrop(win, start);

            arrange();
            return;
        }

        if (!contains(windows, win) || !isTileable(win)) {
            arrange();
            return;
        }

        if (kind === "resize") {
            applyResize(win);
        } else if (start) {
            const g = win.frameGeometry;

            if (g.x !== start.x || g.y !== start.y)
                swapByDrop(win);
        }

        arrange();
    });
}

// --------------------------------------------------
// Tracking windows
// --------------------------------------------------

/* Moves a window to the end of the tiling order (it counts as new there). */
function sendToEnd(win) {
    if (!contains(windows, win))
        return;

    removeFromList(windows, win);
    windows.push(win);
}

function trackWindow(win) {
    if (!isCandidate(win) || contains(trackedWindows, win))
        return;

    trackedWindows.push(win);

    connectDragSwap(win);

    win.minimizedChanged.connect(function () {
        dbg("minimized changed \"" + win.caption + "\" -> " + win.minimized);

        if (!win.minimized)
            sendToEnd(win);       // coming back from minimized = new arrival

        arrange();
    });

    // Fullscreen and maximize keep the window's place in the order.
    win.fullScreenChanged.connect(function () { arrange(); });

    // Arriving on another desktop or screen = new arrival there.
    win.desktopsChanged.connect(function () {
        sendToEnd(win);
        arrange();
    });

    win.outputChanged.connect(function () {
        sendToEnd(win);
        arrange();
    });

    // Mode 0 = restored. The signal fires BEFORE geometry changes, so on
    // restore we wait for the first geometry change, then retile.
    win.maximizedAboutToChange.connect(function (mode) {
        if (contains(floatingWindows, win))
            return;

        if (mode === 0) {
            if (contains(suspendedWindows, win)) {
                removeFromList(suspendedWindows, win);

                if (!contains(pendingRestore, win))
                    pendingRestore.push(win);
            }
        } else if (!contains(suspendedWindows, win)) {
            suspendedWindows.push(win);
            removeFromList(pendingRestore, win);
            arrange();
        }
    });

    win.frameGeometryChanged.connect(function () {
        if (debugOn && !arranging) {
            const g = win.frameGeometry;

            dbg("geometry changed (not by us) \"" + win.caption + "\" "
                + Math.round(g.x) + "," + Math.round(g.y) + " " + Math.round(g.width) + "x" + Math.round(g.height));
        }

        if (arranging)
            return;

        if (contains(pendingRestore, win)) {
            removeFromList(pendingRestore, win);
            arrange();
            return;
        }

        checkSettled(win);
    });
}

/*
 * After we assign a tile, an app can still end up at another size: it
 * refuses to shrink (minimum size) or resizes itself a moment later. If it
 * is clearly BIGGER than its tile, remember that as its minimum so the
 * neighbours make room; either way re-apply the tile. At most 3 attempts
 * per assigned tile, so this can never loop.
 */
function checkSettled(win) {
    if (movingWindow || !contains(windows, win) || !isTileable(win) || overflowSet.has(win))
        return;

    const p = placed.get(win);

    if (!p)
        return;

    const g = win.frameGeometry;

    if (Math.abs(g.x - p.x) <= 1 && Math.abs(g.y - p.y) <= 1
        && Math.abs(g.width - p.width) <= 1 && Math.abs(g.height - p.height) <= 1) {
        // It fits its tile, so whatever was learned earlier no longer holds.
        const o = observedMin.get(win);

        if (o) {
            if (p.width < o.width - 2) o.width = 0;
            if (p.height < o.height - 2) o.height = 0;
            if (o.width === 0 && o.height === 0)
                observedMin.delete(win);
        }

        return;
    }

    const sig = p.x + "," + p.y + "," + p.width + "," + p.height;
    let t = fixTries.get(win);

    if (!t || t.sig !== sig)
        t = { sig: sig, n: 0 };

    if (t.n >= 3)
        return;

    t.n++;
    fixTries.set(win, t);

    // Only believe "it won't shrink" after the re-apply already failed once:
    // a client that is slow to follow a new size looks the same for a moment.
    if (t.n >= 2 && (g.width > p.width + 2 || g.height > p.height + 2)) {
        const o = observedMin.get(win) || { width: 0, height: 0 };

        if (g.width > p.width + 2)
            o.width = Math.max(o.width, g.width);

        if (g.height > p.height + 2)
            o.height = Math.max(o.height, g.height);

        observedMin.set(win, o);
        dbg("\"" + win.caption + "\" won't shrink below " + Math.round(o.width) + "x" + Math.round(o.height));
    }

    arrange();
}

function addWindow(win) {
    if (applySettings() && ready)
        arrange();            // e.g. a new tile limit

    // Nothing you would tile opens this small: it is a tooltip-like overlay.
    // Decided once, here, so a tile that later becomes narrow is unaffected.
    if (win && win.frameGeometry && !overlaySet.has(win)
        && (win.frameGeometry.width < 120 || win.frameGeometry.height < 60))
        overlaySet.add(win);

    if (debugOn && win)
        dbg("window appeared: \"" + win.caption + "\" " + describeFlags(win));

    if (!isCandidate(win)) {
        const why = whyNot(win);

        // Tooltips and popups appear all the time: only mention them in debug mode.
        const noisy = /^(tooltip|outline|doesn't take input|hidden from|KWin's own)/.test(why);

        if (win && win.normalWindow && (!noisy || debugOn))
            print("Alternating Tile: not tiling \"" + win.caption + "\" [class="
                  + win.resourceClass + "]: " + why);

        return;
    }

    dbg("added \"" + win.caption + "\" [class=" + win.resourceClass + "]");
    trackWindow(win);

    const known = contains(floatingWindows, win)
        || contains(suspendedWindows, win)
        || contains(windows, win);

    if (!known && matchesFloatClass(win)) {
        // Quick-use app: opens floating, centred, and stays out of the tiles.
        floatingWindows.push(win);
        arrange();
        centerOnScreen(win);
        raiseOnly(win);
        return;
    }

    if (!known) {
        rememberOpenSize(win);     // before we place it: what did it ask for?
        windows.push(win);
    }

    arrange();
}

function forgetWindow(win) {
    removeFromList(windows, win);
    removeFromList(floatingWindows, win);
    removeFromList(suspendedWindows, win);
    removeFromList(trackedWindows, win);
    removeFromList(pendingRestore, win);
    placed.delete(win);
    openShare.delete(win);
    overflowSet.delete(win);
    overlaySet.delete(win);
    observedMin.delete(win);
    fixTries.delete(win);
    dbg("removed \"" + win.caption + "\"");

    if (movingWindow === win) {
        movingWindow = null;
        moveKind = null;
    }

    arrange();
}

// --------------------------------------------------
// Diagnostics
// --------------------------------------------------

function describeWindow(win) {
    let state;

    if (!isCandidate(win))                    state = "NOT TILED: " + whyNot(win);
    else if (contains(floatingWindows, win))  state = "floating (you or a class rule floated it)";
    else if (overflowSet.has(win))            state = "floating: more than " + MAX_TILED + " windows";
    else if (contains(suspendedWindows, win)) state = "maximized, left out of the layout";
    else if (win.minimized)                   state = "minimized";
    else if (win.fullScreen)                  state = "fullscreen";
    else if (!contains(windows, win))         state = "NOT TILED: not in the layout list";
    else                                      state = "tiled, weight " + weightOf(win).toFixed(2);

    return "  " + win.caption + "  [class=" + win.resourceClass
        + ", name=" + win.resourceName + "]  ->  " + state;
}

function geometryReport(win) {
    const p = placed.get(win);
    const g = win.frameGeometry;
    const o = observedMin.get(win);
    const m = win.minSize;
    let text = "     actual " + Math.round(g.width) + "x" + Math.round(g.height);

    if (p) {
        text += ", tile " + p.width + "x" + p.height;

        if (g.width > p.width + 2 || g.height > p.height + 2)
            text += "  <-- LARGER THAN ITS TILE";
    }

    if (m && (m.width > 0 || m.height > 0))
        text += ", declared min " + Math.round(m.width) + "x" + Math.round(m.height);

    if (o)
        text += ", observed min " + Math.round(o.width) + "x" + Math.round(o.height);

    return text;
}

function dumpState() {
    const screen = currentScreen();
    const key = layoutKey(screen);

    print("Alternating Tile state: smart=" + (smartOn ? "on" : "off")
          + " mirror=" + !!mirrored[key] + " gaps=" + (gapsOn ? "on" : "off")
          + " innerGap=" + INNER_GAP + " outerGap=" + OUTER_GAP
          + " maxTiled=" + MAX_TILED
          + " manualSizes=" + JSON.stringify(manual[key] || {}));
    print("  floating apps: " + Array.from(floatClassSet).join(", "));

    const info = splitInfo[key];

    if (info) {
        print("  splits: " + info.splits.map(function (s, k) {
            return k + ":" + s.axis + " " + percent(s.ratio);
        }).join(", "));
    }

    // Tiling order first (this decides who sits where), then everything else.
    const order = tiledOn(screen);

    order.forEach(function (win, i) {
        print("  #" + (i + 1) + describeWindow(win));
        print(geometryReport(win));
    });

    for (const win of workspace.stackingOrder) {
        if (win && win.normalWindow && order.indexOf(win) === -1)
            print(describeWindow(win));
    }
}

// --------------------------------------------------
// Shortcuts
// --------------------------------------------------

function shortcut(name, keys, fn, label) {
    registerShortcut("Alternating Tile: " + name,
                     "Alternating Tile: " + (label || name), keys, fn);
}

shortcut("Toggle Floating", "Meta+Shift+F", toggleFloating);
shortcut("Promote to Master", "Meta+Return", promoteToMaster);

shortcut("Focus Left",  "Meta+H", function () { focusDirection("left"); });
shortcut("Focus Down",  "Meta+J", function () { focusDirection("down"); });
shortcut("Focus Up",    "Meta+K", function () { focusDirection("up"); });
shortcut("Focus Right", "Meta+L", function () { focusDirection("right"); });

shortcut("Swap Left",  "Meta+Shift+H", function () { swapDirection("left"); });
shortcut("Swap Down",  "Meta+Shift+J", function () { swapDirection("down"); });
shortcut("Swap Up",    "Meta+Shift+K", function () { swapDirection("up"); });
shortcut("Swap Right", "Meta+Shift+L", function () { swapDirection("right"); });

shortcut("Focus Next Window",     "Meta+Alt+J", function () { cycleFocus(1); });
shortcut("Focus Previous Window", "Meta+Alt+K", function () { cycleFocus(-1); });

shortcut("Ratio Wider",    "Meta+Ctrl+L", function () { adjustRatio("V",  RATIO_STEP); });
shortcut("Ratio Narrower", "Meta+Ctrl+H", function () { adjustRatio("V", -RATIO_STEP); });
shortcut("Ratio Taller",   "Meta+Ctrl+K", function () { adjustRatio("H",  RATIO_STEP); });
shortcut("Ratio Shorter",  "Meta+Ctrl+J", function () { adjustRatio("H", -RATIO_STEP); });
shortcut("Reset Ratios",   "Meta+Ctrl+0", resetRatios);
shortcut("Toggle Smart Sizing", "Meta+Ctrl+S", toggleSmart);

shortcut("Rotate Windows Forward",  "Meta+Ctrl+R",       function () { rotateWindows(1); });
shortcut("Rotate Windows Backward", "Meta+Ctrl+Shift+R", function () { rotateWindows(-1); });
shortcut("Mirror Layout", "Meta+Ctrl+M", mirrorLayout);
shortcut("Toggle Gaps",   "Meta+Ctrl+G", toggleGaps);
shortcut("Dump State to Log", "Meta+Ctrl+D", dumpState);
shortcut("Toggle Float for This App", "Meta+Ctrl+F", toggleAppFloat);
shortcut("Reload Settings", "", function () {
    osd(applySettings() ? "Settings reloaded" : "Settings unchanged");
    arrange();
});
shortcut("Toggle Debug Log", "Meta+Ctrl+Shift+D", function () {
    debugOn = !debugOn;
    print("Alternating Tile: debug log " + (debugOn ? "on" : "off"));
    osd(debugOn ? "Debug log on" : "Debug log off");
});

// Unbound by default: the Tiling Controls widget (or you) can trigger these.
for (let pct = 30; pct <= 80; pct += 5) {
    (function (value) {
        shortcut("Share " + value, "", function () { setShare(value); },
                 "Give focused window " + value + "% of its split");
    })(pct);
}

// --------------------------------------------------
// KWin signals + init
// --------------------------------------------------

function safe(name, fn) {
    return function () {
        try {
            return fn.apply(null, arguments);
        } catch (error) {
            print("Alternating Tile: error in " + name + ": " + error);
        }
    };
}

workspace.windowAdded.connect(safe("windowAdded", addWindow));
workspace.windowRemoved.connect(safe("windowRemoved", forgetWindow));

if (workspace.windowActivated && workspace.windowActivated.connect) {
    workspace.windowActivated.connect(function (win) {
        dbg("activated " + (win ? "\"" + win.caption + "\"" : "(none)"));

        if (win && isCandidate(win))
            lastFocused = win;
    });
}

workspace.currentDesktopChanged.connect(function () { arrange(); });
workspace.screensChanged.connect(function () { arrange(); });

applySettings();

for (const win of workspace.stackingOrder) {
    if (!isCandidate(win))
        continue;

    trackWindow(win);

    if (matchesFloatClass(win)) {
        if (!contains(floatingWindows, win))
            floatingWindows.push(win);      // already open: float it where it is
    } else if (!contains(windows, win)) {
        windows.push(win);
    }
}

lastFocused = focusedWindow();
arrange();
ready = true;

print("Alternating Master Stack v1.7 loaded: max " + MAX_TILED + " tiled, smart sizing " + (smartOn ? "on" : "off")
      + ", innerGap=" + INNER_GAP + ", outerGap=" + OUTER_GAP
      + ", ignored=" + IGNORED_CLASSES.join("|"));
