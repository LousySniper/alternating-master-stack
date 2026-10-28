/*
 * Alternating Master Stack v1.8 — KDE Plasma 6
 *
 * Alternating tiling with smart sizing, a tile limit, floating apps and
 * mouse / keyboard control. Window order is never changed automatically.
 * Features, shortcuts and settings: see README.md.
 */

// --------------------------------------------------
// Settings (edit here)
// --------------------------------------------------

const INNER_GAP = 8;             // px between windows (default; the settings page can change it)
const OUTER_GAP = 8;             // px around the screen edge (default; ditto)
const SHOW_MESSAGES = true;      // short on-screen message after changes (default; ditto)
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

/* How much room a kind of window likes (1.0 = normal); first word contained in the class or name wins. */
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

/* Apps that open floating, by category (exact class or name, case-insensitive). */
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
let ready = false;           // false while the script is starting up
let innerGap = INNER_GAP;    // from the settings page
let outerGap = OUTER_GAP;
let showMessages = SHOW_MESSAGES;
let floatAll = false;        // every window opens floating unless its app is set to tile
let middleToggle = false;    // middle-click (bound to "Decrease opacity") = tile toggle
let syncingOpacity = false;  // true while we undo that opacity step
let minimizeOnTile = true;   // tiling a window by hand minimizes the untiled ones

const floatClassSet = new Set();   // filled by applySettings()
const tileClassSet = new Set();    // "Always tile" from the settings page
const savedTile = new Set();       // apps you tiled with the button, window menu or Meta+Ctrl+F (kept across restarts)
const savedFloat = new Set();      // apps you floated the same way
const observedMin = new Map(); // window -> size it showed it cannot shrink below
const fixTries = new Map();   // window -> { sig, n }: re-apply attempts for one assigned rect
const overlaySet = new Set();  // tiny windows at first sight: tooltips and the like
const overflowSet = new Set(); // windows floating only because of MAX_TILED
const maximizedSet = new Set(); // maximized windows, floating ones included
const pendingFloat = new Set(); // left fullscreen / maximized: centred once KWin has restored it
const timers = new Set();       // running timers, kept so they aren't garbage collected
const soloMax = new Set();      // lone tiles, maximized through KWin rather than sized by us
let soloChanging = false;       // true while we maximize / restore one of them

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

/* A whole number of pixels, 0..64; anything else falls back to the default. */
function readInt(key, fallback) {
    const v = parseInt(readSetting(key, fallback), 10);

    return isFinite(v) ? clamp(v, 0, 64) : fallback;
}

function readList(key) {
    return String(readSetting(key, "")).toLowerCase().split(/[\s,;]+/).filter(function (x) { return x !== ""; });
}

/* Reads the settings page. True when something changed. */
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
    const gaps = [readInt("gapInner", INNER_GAP), readInt("gapOuter", OUTER_GAP)];
    const messages = readBool("osdMessages", SHOW_MESSAGES);
    const all = readBool("floatAll", false);
    const middle = readBool("middleClickToggle", false);
    const minimize = readBool("minimizeOnTile", true);

    extra.forEach(function (c) { set.add(c); });
    never.forEach(function (c) { set.delete(c); });

    const sig = JSON.stringify([groups, extra, never, maxTiled, gaps, messages, all, middle, minimize]);

    if (sig === settingsSig)
        return false;

    settingsSig = sig;
    floatClassSet.clear();
    set.forEach(function (c) { floatClassSet.add(c); });
    tileClassSet.clear();
    never.forEach(function (c) { tileClassSet.add(c); });
    MAX_TILED = maxTiled;
    floatAll = all;
    middleToggle = middle;
    minimizeOnTile = minimize;
    innerGap = gaps[0];
    outerGap = gaps[1];
    showMessages = messages;
    return true;
}

function appKey(win) {
    return String(win.resourceClass || win.resourceName || "").toLowerCase();
}

function matchesSet(set, win) {
    const cls = String(win.resourceClass || "").toLowerCase();
    const name = String(win.resourceName || "").toLowerCase();

    return set.has(cls) || (name !== "" && set.has(name));
}

function matchesFloatClass(win) {
    return matchesSet(floatClassSet, win);
}

/* Why a new window opens floating ("" = it tiles). */
function floatReason(win) {
    const key = appKey(win);

    if (savedTile.has(key))         return "";
    if (savedFloat.has(key))        return "saved";
    if (matchesSet(tileClassSet, win)) return "";
    if (matchesFloatClass(win))     return "class";
    if (floatAll)                   return "all";

    return "";
}

// --------------------------------------------------
// Saved per-app choices (written to kwinrc through Plasma's scripting API)
// --------------------------------------------------

const SAVE_GROUP = "Script-alternating-master-stack";

function loadSavedApps() {
    readList("tiledApps").forEach(function (c) { savedTile.add(c); });
    readList("floatedApps").forEach(function (c) { if (!savedTile.has(c)) savedFloat.add(c); });
}

/* Only plain class names are saved: they end up inside a script string. */
function plainClass(c) {
    return /^[a-z0-9._-]+$/.test(c);
}

function saveApps() {
    function list(set) {
        return Array.from(set).filter(plainClass).sort().join(",");
    }

    const js = "var c = ConfigFile('kwinrc', '" + SAVE_GROUP + "');"
        + "c.writeEntry('tiledApps', '" + list(savedTile) + "');"
        + "c.writeEntry('floatedApps', '" + list(savedFloat) + "');";

    try {
        callDBus("org.kde.plasmashell", "/PlasmaShell", "org.kde.PlasmaShell", "evaluateScript", js);
    } catch (error) {
        print("Alternating Tile: could not save the app choice: " + error);
    }
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

    // KWin's tooltips and popups can claim to be normal windows: trust only type flags.
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

/* On the current activity (no list = all activities). */
function onCurrentActivity(win) {
    const current = workspace.currentActivity;
    const list = win.activities;

    if (!current || !list || list.length === 0)
        return true;

    return contains(list, current);
}

function layoutKey(screen) {
    const d = workspace.currentDesktop;
    const a = workspace.currentActivity;

    return String(screen.name) + ":" + String(d && d.id !== undefined ? d.id : d)
        + (a ? ":" + a : "");
}

/* The window actions apply to: the focused one, or the last tileable one that had focus. */
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
            && onCurrentActivity(win)
            && win.output === screen;
    });
}

/* The windows that actually get a tile: the first MAX_TILED. */
function tiledOn(screen) {
    return candidatesOn(screen).slice(0, MAX_TILED);
}

function gapIn() {
    return gapsOn ? innerGap : 0;
}

function gapOut() {
    return gapsOn ? outerGap : 0;
}

/* Short on-screen message (Plasma's OSD). Silently skipped if unavailable. */
function osd(text) {
    if (!showMessages)
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

/* A window that opened big wants more room. */
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

/* Minimum along an axis: declared or observed, capped. */
function minAlong(win, axis, extent) {
    const m = win.minSize;
    const o = observedMin.get(win);
    let declared = 0;
    let seen = 0;

    if (m && isFinite(axis === "V" ? m.width : m.height))
        declared = axis === "V" ? m.width : m.height;

    if (o)
        seen = axis === "V" ? o.width : o.height;

    // Declared minimums are capped at 60%, observed ones at 85%.
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

/* Moves ratio r so both sides of split k fit their minimum sizes where possible. */
function fitMinimums(r, list, k, axis, extent, avail) {
    const needFirst = minAlong(list[k], axis, extent);
    const needRest = maxMinAlong(list, k + 1, axis, extent);

    if (needFirst <= 0 && needRest <= 0)
        return r;

    const lo = needFirst / avail;
    const hi = 1 - needRest / avail;

    return (lo > hi) ? needFirst / (needFirst + needRest) : clamp(r, lo, hi);
}

/* Share of split k for its first window, from the weights on each side. */
function smartRatio(weights, k) {
    let rest = 0;

    for (let j = k + 1; j < weights.length; ++j)
        rest += weights[j];

    return clamp(weights[k] / (weights[k] + rest), AUTO_MIN, AUTO_MAX);
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

    win.frameGeometry = r;
}

/* Axis for the next split: alternates, unless the region's shape says otherwise. */
function chooseAxis(previous, region) {
    const strict = (previous === "V") ? "H" : "V";

    if (strict === "V" && region.height > region.width * AXIS_OVERRIDE)
        return "H";

    if (strict === "H" && region.width > region.height * AXIS_OVERRIDE)
        return "V";

    return strict;
}

/* Window k takes the first part of split k; the rest share the second part. */
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
            ratio = smartRatio(weights, k);
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

        // Windows beyond the limit float.
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

        if (list.length === 1 && canSoloMax(list[0])) {
            soloMaximize(list[0], area);
            delete splitInfo[key];
            continue;
        }

        list.forEach(soloRestore);

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

/* A lone tile is maximized through KWin, so floating it is KWin's own restore. */
function canSoloMax(win) {
    return typeof win.setMaximize === "function" && win.maximizable !== false;
}

function soloMaximize(win, area) {
    placed.set(win, { x: area.x, y: area.y, width: area.width, height: area.height });

    if (soloMax.has(win))
        return;

    soloMax.add(win);
    soloChanging = true;

    try {
        win.setMaximize(true, true);
    } finally {
        soloChanging = false;
    }
}

/* No longer a lone tile: back to a normal window, so we can size it. */
function soloRestore(win) {
    if (!soloMax.delete(win) || win.deleted)
        return;

    soloChanging = true;

    try {
        win.setMaximize(false, false);
    } finally {
        soloChanging = false;
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

/* Centre a window on its screen; a nearly screen-sized one is shrunk. */
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

/* Minimize the windows on that screen that aren't tiles (only those with a task bar entry). */
function minimizeUntiled(screen) {
    if (!minimizeOnTile)
        return;

    const tiles = tiledOn(screen);

    for (const w of workspace.stackingOrder.slice()) {
        if (!w || w.deleted || w.minimized || w.skipTaskbar || !isCandidate(w) || contains(tiles, w))
            continue;

        if (w.output === screen && onCurrentDesktop(w) && onCurrentActivity(w))
            w.minimized = true;
    }
}

function isFloatingNow(win) {
    return contains(floatingWindows, win) || overflowSet.has(win);
}

/* Float / unfloat the focused window. */
function toggleFloating() {
    const win = focusedWindow();

    if (win)
        toggleWindowFloating(win);
}

/* Leave fullscreen / maximized before the window is moved. */
function leaveFullState(win) {
    if (win.fullScreen)
        win.fullScreen = false;

    if (contains(suspendedWindows, win) || maximizedSet.has(win)) {
        removeFromList(suspendedWindows, win);
        removeFromList(pendingRestore, win);

        if (typeof win.setMaximize === "function")
            win.setMaximize(false, false);

        maximizedSet.delete(win);
    }
}

/* After KWin restored it: centre it only if it came back screen-sized. */
function finishFloat(win) {
    if (!pendingFloat.delete(win) || win.deleted || !contains(floatingWindows, win))
        return;

    const area = workspace.clientArea(
        KWin.MaximizeArea, win.output, workspace.currentDesktop);
    const g = win.frameGeometry;

    if (g.width > area.width * 0.9 && g.height > area.height * 0.9)
        centerOnScreen(win);
}

/* Run fn after ms milliseconds. False (and fn not run) where KWin offers no timers. */
function afterDelay(ms, fn) {
    if (typeof QTimer === "undefined")
        return false;

    const t = new QTimer();
    timers.add(t);
    t.singleShot = true;
    t.interval = ms;
    t.timeout.connect(safe("timer", function () {
        timers.delete(t);
        fn();
    }));
    t.start();
    return true;
}

/* Float / tile one window (not the rest of its app). Not saved. */
function toggleWindowFloating(win) {
    if (soloMax.has(win) && !win.fullScreen) {
        // A lone tile: KWin restores it to where it was before it tiled.
        removeFromList(windows, win);
        floatingWindows.push(win);
        placed.delete(win);
        pendingFloat.add(win);
        soloRestore(win);
        arrange();
        raiseAndFocus(win);
        osd("Floating");
        afterDelay(300, function () { finishFloat(win); });
        return;
    }

    if (win.fullScreen || contains(suspendedWindows, win) || maximizedSet.has(win)) {
        // Always floats. Listed before leaving the state, so the restore handlers skip it.
        removeFromList(windows, win);

        if (!contains(floatingWindows, win))
            floatingWindows.push(win);

        // KWin puts it back where it was; moving it too would smear geometry animations.
        pendingFloat.add(win);
        leaveFullState(win);
        arrange();
        raiseAndFocus(win);
        osd("Floating");
        afterDelay(300, function () { finishFloat(win); });   // in case it never moves
        return;
    }

    if (contains(floatingWindows, win)) {
        removeFromList(floatingWindows, win);

        if (!contains(windows, win))
            windows.push(win);

        arrange();

        if (!overflowSet.has(win))
            minimizeUntiled(win.output);

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
        minimizeUntiled(win.output);
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

/* Tile (or float) every window of an app; the choice is saved. */
function setAppTiled(win, tile) {
    const key = appKey(win);

    if (key === "")
        return;

    const same = workspace.stackingOrder.filter(function (w) {
        return w && isCandidate(w) && appKey(w) === key;
    });

    savedTile.delete(key);
    savedFloat.delete(key);
    (tile ? savedTile : savedFloat).add(key);

    saveApps();

    if (tile) {
        for (const w of same) {
            if (contains(floatingWindows, w)) {
                removeFromList(floatingWindows, w);

                if (!contains(windows, w))
                    windows.push(w);
            }
        }

        arrange();
        minimizeUntiled(win.output);
        osd("\"" + key + "\" tiles again");
    } else {
        const floated = [];

        for (const w of same) {
            if (!contains(floatingWindows, w) && !contains(suspendedWindows, w)) {
                removeFromList(windows, w);
                floatingWindows.push(w);
                floated.push(w);
            }
        }

        arrange();
        floated.forEach(function (w) { centerOnScreen(w); });
        raiseAndFocus(win);
        osd("\"" + key + "\" now always floats");
    }
}

function toggleAppFloat() {
    const win = focusedWindow();

    if (win)
        setAppTiled(win, floatReason(win) !== "");     // flip the app's rule
}

// --------------------------------------------------
// Middle-click as the tile toggle
// --------------------------------------------------

/* Middle-click is bound to KWin's "Decrease opacity" (-0.1); that step is undone here and toggles the window. */
function onOpacityChanged(win, old) {
    if (syncingOpacity || !middleToggle || win.deleted || !isCandidate(win) || typeof old !== "number")
        return;

    if (Math.abs(old - win.opacity - 0.1) > 0.01)
        return;

    const g = win.frameGeometry;
    const c = workspace.cursorPos;

    if (!c || c.x < g.x || c.x >= g.x + g.width || c.y < g.y || c.y >= g.y + g.height)
        return;

    syncingOpacity = true;

    try {
        win.opacity = old;
    } finally {
        syncingOpacity = false;
    }

    // After the click: resizing under a held button leaves the old frame on screen.
    if (!afterDelay(250, function () {
        if (!win.deleted)
            toggleWindowFloating(win);
    }))
        toggleWindowFloating(win);
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
    arrange();
    osd(gapsOn ? "Gaps on" : "Gaps off");
}

function toggleSmart() {
    smartOn = !smartOn;
    arrange();
    osd(smartOn ? "Smart sizing on" : "Smart sizing off");
}

// --------------------------------------------------
// Sizes by hand
// --------------------------------------------------

/* Grow / shrink the focused window by moving the nearest split on that axis. */
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

/* Give the focused window pct% of its split. */
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

/* Turn a mouse resize into split ratios, by which edge was dragged. */
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

/* Topmost visible window under the cursor, other than the dragged one. */
function windowAt(dragged) {
    const cursor = workspace.cursorPos;
    const order = workspace.stackingOrder;

    for (let i = order.length - 1; i >= 0; --i) {
        const cand = order[i];

        if (!cand || cand === dragged || cand.deleted || cand.minimized
            || !isCandidate(cand)
            || !onCurrentDesktop(cand)
            || !onCurrentActivity(cand)
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

/* A floating window dropped on a tile takes its place. */
function replaceByDrop(dragged, start) {
    if (!dragged || dragged.deleted)
        return;

    const target = windowAt(dragged);

    if (!target || !contains(tiledOn(dragged.output), target))
        return;                    // dropped on empty space or on another floating window

    // Floating windows only snap in when dropped on a title bar.
    if (!overTitleBar(target))
        return;

    if (!overflowSet.has(dragged) && tiledOn(dragged.output).length < MAX_TILED) {
        // Room left: it takes the target's place, the rest shift along.
        removeFromList(floatingWindows, dragged);

        if (!contains(windows, dragged))
            windows.push(dragged);

        removeFromList(windows, dragged);
        windows.splice(windows.indexOf(target), 0, dragged);
        arrange();
        minimizeUntiled(dragged.output);
        osd("Tiled");
        return;
    }

    if (overflowSet.has(dragged)) {
        // Beyond the limit: swapping order slots swaps tile and overflow.
        swapWindows(dragged, target);
    } else {
        // Not in the order: the replaced window floats explicitly.
        removeFromList(floatingWindows, dragged);
        windows.splice(windows.indexOf(target), 1, dragged);
        floatingWindows.push(target);
    }

    arrange();
    sendFloatTo(target, start);
    minimizeUntiled(dragged.output);
    osd("\"" + target.caption + "\" " + (minimizeOnTile ? "minimized" : "floats"));
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

    if (win.opacityChanged && win.opacityChanged.connect)
        win.opacityChanged.connect(safe("opacityChanged", function (w, old) { onOpacityChanged(win, old); }));

    if (win.activitiesChanged && win.activitiesChanged.connect) {
        win.activitiesChanged.connect(function () {
            sendToEnd(win);
            arrange();
        });
    }

    // Mode 0 = restored; fires before the geometry changes, so retile on the next change.
    win.maximizedAboutToChange.connect(function (mode) {
        if (soloChanging)
            return;

        // A lone tile restored with the title-bar button floats.
        if (soloMax.has(win)) {
            if (mode !== 3) {
                soloMax.delete(win);
                removeFromList(windows, win);
                floatingWindows.push(win);
                placed.delete(win);
                arrange();
                osd("Floating");
            }

            return;
        }

        // Tracked for floating windows too, so they leave the state before moving.
        if (mode === 0)
            maximizedSet.delete(win);
        else
            maximizedSet.add(win);

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
        if (pendingFloat.has(win)) {
            finishFloat(win);
            return;
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

/* A window that stays bigger than its tile: remember that minimum and re-apply (at most 3 tries). */
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

    // Only after a re-apply failed: a slow client looks the same for a moment.
    if (t.n >= 2 && (g.width > p.width + 2 || g.height > p.height + 2)) {
        const o = observedMin.get(win) || { width: 0, height: 0 };

        if (g.width > p.width + 2)
            o.width = Math.max(o.width, g.width);

        if (g.height > p.height + 2)
            o.height = Math.max(o.height, g.height);

        observedMin.set(win, o);
    }

    arrange();
}

function addWindow(win) {
    if (applySettings() && ready)
        arrange();            // e.g. a new tile limit

    // Opened this small: a tooltip-like overlay (decided once, at open).
    if (win && win.frameGeometry && !overlaySet.has(win)
        && (win.frameGeometry.width < 120 || win.frameGeometry.height < 60))
        overlaySet.add(win);

    if (!isCandidate(win))
        return;

    trackWindow(win);

    const known = contains(floatingWindows, win)
        || contains(suspendedWindows, win)
        || contains(windows, win);

    const reason = known ? "" : floatReason(win);

    if (reason !== "") {
        // Opens floating; quick-use apps are centred.
        floatingWindows.push(win);
        arrange();

        if (reason === "class")
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
    maximizedSet.delete(win);
    pendingFloat.delete(win);
    soloMax.delete(win);
    observedMin.delete(win);
    fixTries.delete(win);

    if (movingWindow === win) {
        movingWindow = null;
        moveKind = null;
    }

    arrange();
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
shortcut("Toggle Float for This App", "Meta+Ctrl+F", toggleAppFloat);
shortcut("Reload Settings", "", function () {
    osd(applySettings() ? "Settings reloaded" : "Settings unchanged");
    arrange();
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
        if (win && isCandidate(win))
            lastFocused = win;
    });
}

workspace.currentDesktopChanged.connect(function () { arrange(); });
workspace.screensChanged.connect(function () { arrange(); });

if (workspace.currentActivityChanged && workspace.currentActivityChanged.connect)
    workspace.currentActivityChanged.connect(function () { arrange(); });

// Saving the settings page reconfigures KWin: apply the new settings at once.
if (typeof options !== "undefined" && options && options.configChanged && options.configChanged.connect) {
    options.configChanged.connect(safe("configChanged", function () {
        if (applySettings())
            arrange();
    }));
}

if (typeof registerUserActionsMenu === "function") {
    registerUserActionsMenu(function (win) {
        if (!win || !isCandidate(win))
            return null;

        const appTiled = floatReason(win) === "";     // would a new window of this app tile?

        // Also for apps that draw their own title bar (Alt+F3).
        return {
            text: "Tiling",
            items: [{
                text: "Tile this window",
                checkable: true,
                checked: !isFloatingNow(win),
                triggered: safe("Tile this window", function () { toggleWindowFloating(win); })
            }, {
                text: "Always tile this app",
                checkable: true,
                checked: appTiled,
                triggered: safe("Always tile this app", function () { setAppTiled(win, !appTiled); })
            }]
        };
    });
}

applySettings();
loadSavedApps();

for (const win of workspace.stackingOrder) {
    if (!isCandidate(win))
        continue;

    trackWindow(win);

    if (floatReason(win) !== "") {
        if (!contains(floatingWindows, win))
            floatingWindows.push(win);      // already open: float it where it is
    } else if (!contains(windows, win)) {
        windows.push(win);
    }
}

lastFocused = focusedWindow();
arrange();
ready = true;
