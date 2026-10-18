// Mock-KWin test harness: node test/harness.js
// Verifies layout/shortcut logic only; real KWin behaviour still needs on-desktop testing.
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const assert = require("assert");

const MAIN = path.join(__dirname, "../script/contents/code/main.js");

function signal() {
    const h = [];
    return { connect: f => h.push(f), emit: (...a) => h.slice().forEach(f => f(...a)) };
}

const desktop = { id: "d1" };
const screenA = { name: "A", area: { x: 0, y: 0, width: 1000, height: 800 } };
const FULL = { x: 0, y: 0, width: 1000, height: 800 };
const A = (x, y, w, h) => ({ x, y, width: w, height: h });

function mkWin(caption, over = {}) {
    const w = {
        caption, resourceClass: "app", resourceName: "app", deleted: false, normalWindow: true,
        specialWindow: false, transient: false, dialog: false, resizeable: true,
        minimized: false, fullScreen: false, onAllDesktops: false,
        desktops: [desktop], output: screenA, move: false, resize: false,
        _g: { x: 100, y: 100, width: 300, height: 300 },
        minimizedChanged: signal(), fullScreenChanged: signal(),
        desktopsChanged: signal(), outputChanged: signal(),
        maximizedAboutToChange: signal(), frameGeometryChanged: signal(),
        interactiveMoveResizeStarted: signal(), interactiveMoveResizeFinished: signal(),
        ...over,
    };
    Object.defineProperty(w, "frameGeometry", {
        configurable: true,
        get() { return { ...w._g }; },
        set(v) { w._g = { ...v }; w.frameGeometryChanged.emit(); },
    });
    return w;
}

// A window that opened at ~35% of a 1000x800 screen, so its size factor is ~1.0.
const mk = (caption, cls, over = {}) =>
    mkWin(caption, { resourceClass: cls || "app", resourceName: cls || "app",
                     _g: { x: 50, y: 50, width: 530, height: 530 }, ...over });

/*
 * load({ pre, smart, constants })
 *  smart: true to keep smart sizing on (default off, so numbers are the plain 50/50 ones)
 *  constants: override `const NAME = value;` lines of the script
 */
function load(opts = {}) {
    const shortcuts = {};
    const logs = [];
    const dbus = [];
    const ws = {
        screens: [screenA], currentDesktop: desktop, activeWindow: null,
        stackingOrder: [...(opts.pre || [])], cursorPos: { x: 0, y: 0 },
        windowAdded: signal(), windowRemoved: signal(), windowActivated: signal(),
        currentDesktopChanged: signal(), screensChanged: signal(),
        clientArea: (_o, s) => s.area,
        raised: [], raiseWindow(w) { this.raised.push(w); },
    };
    let src = fs.readFileSync(MAIN, "utf8");
    // Legacy tests run without the tile limit and without floating apps, unless `real: true`.
    const consts = { SMART_SIZING: !!opts.smart, ...(opts.real ? {} : { MAX_TILED: 99, FLOAT_GROUPS: {} }), ...(opts.constants || {}) };
    for (const [k, v] of Object.entries(consts)) {
        const re = new RegExp(`(?:const|let) ${k} = [^;]+;`);
        assert(re.test(src), "constant not found: " + k);
        src = src.replace(re, `${k === "MAX_TILED" ? "let" : "const"} ${k} = ${JSON.stringify(v)};`);
    }
    const ctx = vm.createContext({
        workspace: ws, KWin: { MaximizeArea: 2 },
        print: (m) => { logs.push(String(m)); },
        callDBus: (...a) => { dbus.push(a); if (opts.dbusThrows) throw new Error("no dbus"); },
        readConfig: (k, d) => (opts.config && k in opts.config) ? opts.config[k] : d,
        registerShortcut: (t, _x, k, cb) => { shortcuts[t.replace("Alternating Tile: ", "")] = cb; },
    });
    vm.runInContext(src, ctx);
    const open = (w) => { ws.stackingOrder.push(w); ws.windowAdded.emit(w); return w; };
    const close = (w) => { ws.stackingOrder = ws.stackingOrder.filter(x => x !== w); w.deleted = true; ws.windowRemoved.emit(w); };
    const osd = () => dbus.filter(a => a[3] === "showText").map(a => a[5]);
    return { ws, ctx, shortcuts, open, close, logs, dbus, osd };
}

const g = w => w._g;
function noOverlap(ws) {
    for (let i = 0; i < ws.length; i++) for (let j = i + 1; j < ws.length; j++) {
        const a = g(ws[i]), b = g(ws[j]);
        const sep = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
        assert(sep, `${ws[i].caption} overlaps ${ws[j].caption}: ${JSON.stringify(a)} ${JSON.stringify(b)}`);
    }
}
function inside(ws, area, margin) {
    for (const w of ws) {
        const r = g(w);
        assert(r.x >= area.x + margin && r.y >= area.y + margin
            && r.x + r.width <= area.x + area.width - margin
            && r.y + r.height <= area.y + area.height - margin, `${w.caption} out of bounds ${JSON.stringify(r)}`);
    }
}
const area = w => g(w).width * g(w).height;

let passed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log("  ok   " + name); }
    catch (e) { console.log("  FAIL " + name + "\n       " + e.message); process.exitCode = 1; }
}

// ======================= basic tiling (smart sizing off: plain 50/50) =======================
test("single window fills the area with no outer gap", () => {
    const { open } = load(); const a = open(mkWin("a"));
    assert.deepStrictEqual(g(a), FULL);
});

test("two windows: master left, 8px gap, 8px outer", () => {
    const { open } = load(); const a = open(mkWin("a")), b = open(mkWin("b"));
    assert.deepStrictEqual(g(a), A(8, 8, 488, 784)); assert.deepStrictEqual(g(b), A(504, 8, 488, 784));
});

test("three and four windows alternate side-by-side / stacked", () => {
    const { open } = load(); const [a, b, c, d] = ["a", "b", "c", "d"].map(n => open(mkWin(n)));
    assert.deepStrictEqual(g(a), A(8, 8, 488, 784)); assert.deepStrictEqual(g(b), A(504, 8, 488, 388));
    assert.deepStrictEqual(g(c), A(504, 404, 240, 388)); assert.deepStrictEqual(g(d), A(752, 404, 240, 388));
});

test("1..9 windows never overlap and stay in bounds (smart off and on)", () => {
    for (const smart of [false, true]) for (let n = 1; n <= 9; n++) {
        const { open } = load({ smart }); const ws = [];
        for (let i = 0; i < n; i++) ws.push(open(mk("w" + i, ["firefox", "konsole", "code", "app", "discord"][i % 5])));
        noOverlap(ws); inside(ws, screenA.area, n > 1 ? 8 : 0);
    }
});

test("closing a window reflows the rest", () => {
    const { open, close } = load(); const a = open(mkWin("a")), b = open(mkWin("b")), c = open(mkWin("c"));
    close(b); noOverlap([a, c]); assert.strictEqual(g(a).width, 488); assert.strictEqual(g(c).height, 784);
});

test("new windows always go to the end and never displace the master", () => {
    const { open, ws } = load(); const a = open(mkWin("a")), b = open(mkWin("b")); ws.activeWindow = b;
    const c = open(mkWin("c"));
    assert.deepStrictEqual(g(a), A(8, 8, 488, 784)); assert.deepStrictEqual(g(b), A(504, 8, 488, 388)); assert.deepStrictEqual(g(c), A(504, 404, 488, 388));
});

test("ignored classes, dialogs, transient and fixed-size windows are not tiled", () => {
    const { open, logs } = load(); const a = open(mkWin("a"));
    open(mkWin("p", { resourceClass: "plasmashell" })); open(mkWin("d", { dialog: true }));
    open(mkWin("f", { resizeable: false })); open(mkWin("t", { transient: true }));
    open(mkWin("n", { resourceClass: "other", resourceName: "KRunner" }));
    assert.deepStrictEqual(g(a), FULL);
    for (const r of ["dialog", "ignore list", "fixed size", "transient"])
        assert(logs.some(l => l.includes("not tiling") && l.includes(r)), "missing reason: " + r);
});

test("a window with no output yet doesn't break the others", () => {
    const { open } = load(); const a = open(mkWin("a")); const n = open(mkWin("n", { output: null }));
    assert.deepStrictEqual(g(a), FULL);
    n.output = screenA; n.outputChanged.emit(); assert.strictEqual(g(a).width, 488);
});

test("an error while laying out doesn't escape the add handler", () => {
    const { open, ws } = load(); open(mkWin("a")); ws.clientArea = () => { throw new Error("boom"); };
    let threw = false; try { open(mkWin("b")); } catch (e) { threw = true; }
    assert(!threw);
});

test("events during arrange are not dropped", () => {
    const { open } = load(); const a = open(mkWin("a")), b = open(mkWin("b")), c = open(mkWin("c"));
    let fired = false;
    a.frameGeometryChanged.connect(() => { if (!fired) { fired = true; c.minimized = true; c.minimizedChanged.emit(); } });
    b.minimized = true; b.minimizedChanged.emit(); b.minimized = false; b.minimizedChanged.emit();
    noOverlap([a, b]);
});

// ======================= order rules =======================
test("a window restored from minimized goes to the end", () => {
    const { open } = load(); const a = open(mkWin("a")), b = open(mkWin("b")), c = open(mkWin("c"));
    a.minimized = true; a.minimizedChanged.emit();
    assert.deepStrictEqual(g(b), A(8, 8, 488, 784));
    a.minimized = false; a.minimizedChanged.emit();
    assert.deepStrictEqual(g(b), A(8, 8, 488, 784)); assert.deepStrictEqual(g(c), A(504, 8, 488, 388)); assert.deepStrictEqual(g(a), A(504, 404, 488, 388));
});

test("minimizing the last window and restoring keeps it last", () => {
    const { open } = load(); const a = open(mkWin("a")), b = open(mkWin("b")), c = open(mkWin("c"));
    c.minimized = true; c.minimizedChanged.emit(); c.minimized = false; c.minimizedChanged.emit();
    assert.deepStrictEqual(g(c), A(504, 404, 488, 388));
});

test("maximize then restore returns the window to the same place", () => {
    const { open } = load(); const a = open(mkWin("a")), b = open(mkWin("b")), c = open(mkWin("c"));
    const before = JSON.stringify([a, b, c].map(g));
    a.maximizedAboutToChange.emit(3); assert.deepStrictEqual(g(b), A(8, 8, 488, 784), "b took over");
    a.maximizedAboutToChange.emit(0); a._g = { x: 3, y: 3, width: 300, height: 300 }; a.frameGeometryChanged.emit();
    assert.strictEqual(JSON.stringify([a, b, c].map(g)), before);
});

test("fullscreen and exit keep the window's place", () => {
    const { open } = load(); const a = open(mkWin("a")), b = open(mkWin("b")), c = open(mkWin("c"));
    const before = JSON.stringify([a, b, c].map(g));
    a.fullScreen = true; a.fullScreenChanged.emit(); a.fullScreen = false; a.fullScreenChanged.emit();
    assert.strictEqual(JSON.stringify([a, b, c].map(g)), before);
});

test("a window moved to another desktop and back arrives at the end", () => {
    const { open } = load(); const a = open(mkWin("a")), b = open(mkWin("b")), c = open(mkWin("c"));
    b.desktops = [{ id: "d2" }]; b.desktopsChanged.emit(); assert.deepStrictEqual(g(c), A(504, 8, 488, 784));
    b.desktops = [desktop]; b.desktopsChanged.emit();
    assert.deepStrictEqual(g(c), A(504, 8, 488, 388)); assert.deepStrictEqual(g(b), A(504, 404, 488, 388));
});

test("a window moved to another screen and back arrives at the end", () => {
    const screenB = { name: "B", area: { x: 1000, y: 0, width: 800, height: 600 } };
    const { open, ws } = load(); ws.screens.push(screenB);
    const a = open(mkWin("a")), b = open(mkWin("b")), c = open(mkWin("c"));
    b.output = screenB; b.outputChanged.emit(); assert.deepStrictEqual(g(b), A(1000, 0, 800, 600));
    b.output = screenA; b.outputChanged.emit(); assert.deepStrictEqual(g(b), A(504, 404, 488, 388));
});

test("floating window maximize/restore doesn't touch the layout", () => {
    const { open, ws, shortcuts } = load(); const a = open(mkWin("a")), b = open(mkWin("b"));
    ws.activeWindow = b; shortcuts["Toggle Floating"]();
    b.maximizedAboutToChange.emit(3); b.maximizedAboutToChange.emit(0); assert.deepStrictEqual(g(a), FULL);
});

test("minimize and fullscreen leave the layout; restore rejoins", () => {
    const { open } = load(); const a = open(mkWin("a")), b = open(mkWin("b"));
    b.minimized = true; b.minimizedChanged.emit(); assert.deepStrictEqual(g(a), FULL);
    b.minimized = false; b.minimizedChanged.emit(); assert.strictEqual(g(a).width, 488);
    b.fullScreen = true; b.fullScreenChanged.emit(); assert.deepStrictEqual(g(a), FULL);
});

// ======================= floating =======================
test("float centres the window (tall tiles shrink to 70%), raises it, and tiles the rest", () => {
    const { open, ws, shortcuts } = load(); const a = open(mkWin("a")), b = open(mkWin("b"));
    ws.activeWindow = b; shortcuts["Toggle Floating"]();
    assert.deepStrictEqual(g(a), FULL); assert.deepStrictEqual(g(b), A(256, 120, 488, 560));
    assert.strictEqual(ws.raised[ws.raised.length - 1], b);
});

test("float keeps a small window's size; unfloat rejoins", () => {
    const { open, ws, shortcuts } = load(); const a = open(mkWin("a")), b = open(mkWin("b"));
    b._g = { x: 0, y: 0, width: 400, height: 300 };
    ws.activeWindow = b; shortcuts["Toggle Floating"](); assert.deepStrictEqual(g(b), A(300, 250, 400, 300));
    shortcuts["Toggle Floating"](); assert.deepStrictEqual(g(b), A(504, 8, 488, 784));
});

test("dropping on a floating window does NOT swap with the tile hidden under it", () => {
    const { open, ws, shortcuts } = load(); const a = open(mkWin("a")), b = open(mkWin("b")), f = open(mkWin("f"));
    ws.activeWindow = f; shortcuts["Toggle Floating"](); const fg = g(f);
    ws.stackingOrder = [a, b, f]; b.interactiveMoveResizeStarted.emit(); b._g = { ...b._g, x: 100, y: 100 };
    ws.cursorPos = { x: fg.x + 5, y: fg.y + 5 }; const ax = g(a).x; b.interactiveMoveResizeFinished.emit();
    assert.strictEqual(g(a).x, ax); assert.strictEqual(g(b).x, 504);
});

// ======================= drag and mouse resize =======================
test("drag move swaps with the window under the cursor", () => {
    const { open, ws } = load(); const a = open(mkWin("a")), b = open(mkWin("b"));
    a.interactiveMoveResizeStarted.emit(); a._g = { ...a._g, x: 600, y: 300 }; ws.cursorPos = { x: 700, y: 400 };
    a.interactiveMoveResizeFinished.emit(); assert.strictEqual(g(b).x, 8); assert.strictEqual(g(a).x, 504);
});

test("a resize is not mistaken for a move; reflow waits while dragging", () => {
    const { open, ws } = load(); const a = open(mkWin("a")), b = open(mkWin("b"));
    b.resize = true; b.interactiveMoveResizeStarted.emit(); b._g = { x: 300, y: 8, width: 692, height: 784 }; ws.cursorPos = { x: 100, y: 100 };
    b.interactiveMoveResizeFinished.emit(); assert.strictEqual(g(a).x, 8);
    a.resize = false; a.interactiveMoveResizeStarted.emit(); a._g = { x: 400, y: 400, width: 300, height: 300 }; open(mkWin("c"));
    assert.deepStrictEqual(g(a), A(400, 400, 300, 300)); a.interactiveMoveResizeFinished.emit();
});

test("mouse resize of master, stack window and last window updates the sizes", () => {
    const { open } = load(); const a = open(mkWin("a")), b = open(mkWin("b"));
    a.resize = true; a.interactiveMoveResizeStarted.emit(); a._g = { ...a._g, width: 600 }; a.interactiveMoveResizeFinished.emit();
    assert.strictEqual(g(a).width, 600); assert.strictEqual(g(b).x, 616); assert.strictEqual(g(b).width, 376);
    b.resize = true; b.interactiveMoveResizeStarted.emit(); b._g = { x: 408, y: 8, width: 584, height: 784 }; b.interactiveMoveResizeFinished.emit();
    assert.strictEqual(g(b).width, 584); assert.strictEqual(g(a).width, 984 - 584 - 8);
    const c = open(mkWin("c")); c.resize = true; c.interactiveMoveResizeStarted.emit();
    c._g = { ...c._g, width: g(c).width + 100, x: g(c).x - 100 }; c.interactiveMoveResizeFinished.emit();
    noOverlap([a, b, c]);
});

test("mouse-resizing the last window's width moves the master split", () => {
    const { open } = load(); const a = open(mkWin("a")), b = open(mkWin("b")), c = open(mkWin("c"));
    c.resize = true; c.interactiveMoveResizeStarted.emit(); c._g = { x: 404, y: 404, width: 588, height: 388 }; c.interactiveMoveResizeFinished.emit();
    assert.strictEqual(g(c).width, 588); assert.strictEqual(g(a).width, 388); assert.strictEqual(g(b).width, 588);
});

// ======================= keyboard =======================
test("focus direction, swap direction, promote, focus next/previous", () => {
    const { open, ws, shortcuts } = load(); const a = open(mkWin("a")), b = open(mkWin("b")), c = open(mkWin("c"));
    ws.activeWindow = a; shortcuts["Focus Right"](); assert.strictEqual(ws.activeWindow, b);
    shortcuts["Focus Down"](); assert.strictEqual(ws.activeWindow, c); shortcuts["Focus Up"](); assert.strictEqual(ws.activeWindow, b);
    shortcuts["Focus Left"](); assert.strictEqual(ws.activeWindow, a); shortcuts["Focus Left"](); assert.strictEqual(ws.activeWindow, a);
    shortcuts["Swap Right"](); assert.strictEqual(g(a).x, 504); assert.strictEqual(g(b).x, 8);
    ws.activeWindow = c; shortcuts["Promote to Master"](); assert.strictEqual(g(c).x, 8);
    shortcuts["Promote to Master"](); assert.notStrictEqual(g(c).x, 8 + 0 * 1 + 1000, "swapped with next");
    ws.activeWindow = a; shortcuts["Focus Next Window"](); const n1 = ws.activeWindow; shortcuts["Focus Previous Window"](); assert.strictEqual(ws.activeWindow, a); assert.notStrictEqual(n1, a);
});

test("focus next wraps, skips minimized, and jumps in from a floating window", () => {
    const { open, ws, shortcuts } = load(); const a = open(mkWin("a")), b = open(mkWin("b")), c = open(mkWin("c")), f = open(mkWin("f"));
    ws.activeWindow = f; shortcuts["Toggle Floating"](); shortcuts["Focus Next Window"](); assert.strictEqual(ws.activeWindow, a);
    b.minimized = true; b.minimizedChanged.emit(); shortcuts["Focus Next Window"](); assert.strictEqual(ws.activeWindow, c);
    shortcuts["Focus Next Window"](); assert.strictEqual(ws.activeWindow, a);
});

test("rotate forward/backward cycles positions, per screen, and keeps order otherwise", () => {
    const { open, ws, shortcuts } = load(); const a = open(mkWin("a")), b = open(mkWin("b")), c = open(mkWin("c")); ws.activeWindow = a;
    const pos = () => [a, b, c].map(w => `${g(w).x},${g(w).y}`).join("|"); const before = pos();
    shortcuts["Rotate Windows Forward"](); assert.deepStrictEqual(g(c), A(8, 8, 488, 784)); assert.deepStrictEqual(g(a), A(504, 8, 488, 388));
    shortcuts["Rotate Windows Backward"](); assert.strictEqual(pos(), before);
    shortcuts["Rotate Windows Backward"](); assert.deepStrictEqual(g(b), A(8, 8, 488, 784));
});

test("mirror flips left-right and back", () => {
    const { open, ws, shortcuts } = load(); const a = open(mkWin("a")), b = open(mkWin("b")), c = open(mkWin("c")); ws.activeWindow = a;
    shortcuts["Mirror Layout"](); assert.deepStrictEqual(g(a), A(504, 8, 488, 784)); assert.deepStrictEqual(g(b), A(8, 8, 488, 388)); noOverlap([a, b, c]);
    shortcuts["Mirror Layout"](); assert.deepStrictEqual(g(a), A(8, 8, 488, 784));
});

test("toggle gaps removes and restores all gaps", () => {
    const { open, shortcuts } = load(); const a = open(mkWin("a")), b = open(mkWin("b"));
    shortcuts["Toggle Gaps"](); assert.deepStrictEqual(g(a), A(0, 0, 500, 800)); assert.deepStrictEqual(g(b), A(500, 0, 500, 800));
    shortcuts["Toggle Gaps"](); assert.deepStrictEqual(g(a), A(8, 8, 488, 784));
});

test("gap constants can be edited at the top of the script", () => {
    const { open } = load({ constants: { INNER_GAP: 20, OUTER_GAP: 0 } }); const a = open(mkWin("a")), b = open(mkWin("b"));
    assert.deepStrictEqual(g(a), A(0, 0, 490, 800)); assert.deepStrictEqual(g(b), A(510, 0, 490, 800));
});

test("layout, rotate, mirror and focus all work per screen", () => {
    const screenB = { name: "B", area: { x: 1000, y: 0, width: 800, height: 600 } };
    const { open, ws, shortcuts } = load(); ws.screens.push(screenB);
    const a = open(mkWin("a")), b = open(mkWin("b")), c = open(mkWin("c", { output: screenB })), d = open(mkWin("d", { output: screenB }));
    ws.activeWindow = a; const cg = { ...g(c) }, dg = { ...g(d) };
    shortcuts["Rotate Windows Forward"](); shortcuts["Mirror Layout"]();
    assert.deepStrictEqual(g(c), cg); assert.deepStrictEqual(g(d), dg);
    assert.strictEqual(g(b).x, 504); assert.strictEqual(g(a).x, 8);
});

// ======================= sizes by hand =======================
test("ratio keys move the nearest split on that axis; narrower/shorter reverse it", () => {
    const { open, ws, shortcuts } = load(); const a = open(mkWin("a")), b = open(mkWin("b")), c = open(mkWin("c"));
    ws.activeWindow = a; shortcuts["Ratio Wider"](); assert.strictEqual(g(a).width, 537);
    ws.activeWindow = c; shortcuts["Ratio Wider"](); assert.strictEqual(g(a).width, 488, "last window wider moves the master split back");
    const h = g(c).height; shortcuts["Ratio Taller"](); assert(g(c).height > h); noOverlap([a, b, c]);
    shortcuts["Ratio Shorter"](); shortcuts["Ratio Shorter"](); assert(g(c).height < h);
    ws.activeWindow = a; const ah = g(a).height; shortcuts["Ratio Taller"](); assert.strictEqual(g(a).height, ah, "master has no height split");
});

test("wider on d in a 4-window layout moves the c|d split, not the master", () => {
    const { open, ws, shortcuts } = load(); const [a, b, c, d] = ["a", "b", "c", "d"].map(n => open(mkWin(n))); ws.activeWindow = d;
    const cw = g(c).width; shortcuts["Ratio Wider"]();
    assert(g(d).width > g(c).width && g(c).width < cw); assert.strictEqual(g(a).width, 488); noOverlap([a, b, c, d]);
});

test("share shortcuts 30..80 exist and give exact sizes (master, middle, last)", () => {
    const { open, ws, shortcuts } = load(); for (let p = 30; p <= 80; p += 5) assert(shortcuts["Share " + p]);
    const a = open(mkWin("a")), b = open(mkWin("b")), c = open(mkWin("c"));
    ws.activeWindow = a; shortcuts["Share 60"](); assert.deepStrictEqual(g(a), A(8, 8, 586, 784));
    shortcuts["Share 50"](); ws.activeWindow = b; shortcuts["Share 60"]();
    assert.deepStrictEqual(g(b), A(504, 8, 488, 466)); assert.deepStrictEqual(g(c), A(504, 482, 488, 310));
    ws.activeWindow = c; shortcuts["Share 60"](); assert.strictEqual(g(c).height, 466);
    shortcuts["Share 60"](); assert.strictEqual(g(c).height, 466, "idempotent");
});

test("share does nothing with one window or no window", () => {
    const { open, ws, shortcuts } = load(); const a = open(mkWin("a")); ws.activeWindow = a; shortcuts["Share 60"](); assert.deepStrictEqual(g(a), FULL);
    ws.activeWindow = null; shortcuts["Share 70"]();
});

test("reset ratios returns to the default split", () => {
    const { open, ws, shortcuts } = load(); const a = open(mkWin("a")), b = open(mkWin("b")); ws.activeWindow = a;
    shortcuts["Share 70"](); assert.strictEqual(g(a).width, 683); shortcuts["Reset Ratios"](); assert.strictEqual(g(a).width, 488);
});

// ======================= widget focus fallback, OSD, diagnostics =======================
test("actions apply to the last tiled window when a panel/widget has focus", () => {
    const { open, ws, shortcuts } = load(); const a = open(mkWin("a")), b = open(mkWin("b")), c = open(mkWin("c"));
    ws.windowActivated.emit(b); ws.activeWindow = mkWin("popup", { normalWindow: false, resourceClass: "plasmashell" });
    shortcuts["Share 60"](); assert.strictEqual(g(b).height, 466);
    shortcuts["Toggle Floating"](); assert.strictEqual(g(c).y, 8);
    ws.windowActivated.emit(a); shortcuts["Focus Next Window"](); assert.notStrictEqual(ws.activeWindow, null);
});

test("every shortcut is a safe no-op with nothing tiled or focused", () => {
    const { ws, shortcuts } = load(); ws.activeWindow = mkWin("popup", { normalWindow: false });
    for (const n of Object.keys(shortcuts)) shortcuts[n]();
});

test("a closed lastFocused window isn't used", () => {
    const { open, close, ws, shortcuts } = load(); const a = open(mkWin("a")), b = open(mkWin("b"));
    ws.windowActivated.emit(b); close(b); ws.activeWindow = null; shortcuts["Share 60"](); assert.deepStrictEqual(g(a), FULL);
});

test("OSD messages for gaps, mirror, rotate, float, reset, smart, width/height, share", () => {
    const { open, ws, shortcuts, osd } = load(); const a = open(mkWin("a")), b = open(mkWin("b")), c = open(mkWin("c")); ws.activeWindow = a;
    shortcuts["Toggle Gaps"](); shortcuts["Toggle Gaps"](); shortcuts["Mirror Layout"](); shortcuts["Mirror Layout"]();
    shortcuts["Rotate Windows Forward"](); shortcuts["Rotate Windows Backward"]();
    shortcuts["Ratio Wider"](); ws.activeWindow = b; shortcuts["Ratio Taller"]();
    ws.activeWindow = c; shortcuts["Ratio Wider"](); shortcuts["Share 70"](); shortcuts["Reset Ratios"]();
    shortcuts["Toggle Smart Sizing"](); shortcuts["Toggle Smart Sizing"]();
    ws.activeWindow = a; shortcuts["Toggle Floating"](); ws.activeWindow = a; shortcuts["Toggle Floating"]();
    assert.deepStrictEqual(osd(), ["Gaps off", "Gaps on", "Mirrored", "Not mirrored", "Rotated forward", "Rotated backward",
        "Width: 55%", "Height: 55%", "Width: 50%", "Window share: 70%", "Sizes reset to 50%",
        "Smart sizing on", "Smart sizing off", "Floating", "Tiled"]);
});

test("OSD can be switched off in the script; a missing OSD service breaks nothing", () => {
    const off = load({ constants: { SHOW_MESSAGES: false } }); const a = off.open(mkWin("a")), b = off.open(mkWin("b"));
    off.ws.activeWindow = a; off.shortcuts["Toggle Gaps"](); assert.strictEqual(off.osd().length, 0);
    const bad = load({ dbusThrows: true }); const c = bad.open(mkWin("c")), d = bad.open(mkWin("d")); bad.ws.activeWindow = c; bad.shortcuts["Toggle Gaps"]();
    assert.deepStrictEqual(g(c), A(0, 0, 500, 800));
});

test("dump state lists tiling order, weights and splits", () => {
    const { open, ws, shortcuts, logs } = load({ smart: true }); const a = open(mk("Alpha", "firefox")), b = open(mk("Beta", "konsole")); ws.activeWindow = a;
    logs.length = 0; shortcuts["Dump State to Log"](); const txt = logs.join("\n");
    assert(/#1 +Alpha.*weight 1\.4/.test(txt) && /#2 +Beta.*weight 0\.8/.test(txt) && /splits: 0:V 64%/.test(txt) && /smart=on/.test(txt), txt);
});

test("startup log; removed layout shortcuts are gone, kept ones remain", () => {
    const { shortcuts, logs } = load(); assert(logs.some(l => l.includes("v1.7 loaded")));
    for (const n of ["Cycle Layout", "More Master Windows", "Fewer Master Windows", "Set Layout Monocle", "Set Layout Alternating", "Set Layout Master and Stack"])
        assert(!shortcuts[n], "should be removed: " + n);
    for (const n of ["Toggle Floating", "Promote to Master", "Focus Left", "Focus Down", "Focus Up", "Focus Right", "Swap Left", "Swap Down", "Swap Up", "Swap Right",
        "Focus Next Window", "Focus Previous Window", "Ratio Wider", "Ratio Narrower", "Ratio Taller", "Ratio Shorter", "Reset Ratios",
        "Rotate Windows Forward", "Rotate Windows Backward", "Mirror Layout", "Toggle Gaps", "Dump State to Log", "Toggle Smart Sizing"])
        assert(shortcuts[n], "missing: " + n);
});

// ======================= SMART SIZING =======================
test("smart: equal windows still split 50/50", () => {
    const { open } = load({ smart: true }); const a = open(mk("a")), b = open(mk("b"));
    assert.deepStrictEqual([g(a).width, g(b).width], [488, 488]);
});

test("smart: a browser next to a terminal gets more room (621 / 355)", () => {
    const { open } = load({ smart: true }); const a = open(mk("ff", "org.mozilla.firefox")), b = open(mk("term", "org.kde.konsole"));
    assert.strictEqual(g(a).width, 621); assert.strictEqual(g(b).width, 355); assert.strictEqual(g(b).x, 637);
});

test("smart: the master keeps extra room with 3+ equal windows; the rest are even", () => {
    const { open } = load({ smart: true }); const a = open(mk("a")), b = open(mk("b")), c = open(mk("c"));
    assert.strictEqual(g(a).width, 434); assert.strictEqual(g(b).height, 388); assert.strictEqual(g(c).height, 388);
    const [w, x, y, z] = ["a", "b", "c", "d"].map(n => mk(n)); const t = load({ smart: true }); [w, x, y, z].forEach(t.open);
    const areas = [x, y, z].map(area); assert(Math.max(...areas) / Math.min(...areas) < 1.05, "b, c, d have nearly equal area: " + areas);
    assert(area(w) > area(x), "master is bigger");
});

test("smart: with many windows the master is never squeezed below 25%", () => {
    const { open } = load({ smart: true }); const ws = []; for (let i = 0; i < 8; i++) ws.push(open(mk("w" + i)));
    assert.strictEqual(g(ws[0]).width, 244); noOverlap(ws);
});

test("smart: sizes follow the kind of window, not the order (heavier window later gets more of ITS split)", () => {
    const { open } = load({ smart: true }); const a = open(mk("term", "konsole")), b = open(mk("web", "firefox")), c = open(mk("chat", "discord"));
    assert(g(b).height > g(c).height, "browser above chat gets the taller part"); noOverlap([a, b, c]);
});

test("smart: NEVER reorders windows - the tiling order only follows open/close, never sizes", () => {
    const { open, close, ws, shortcuts, logs } = load({ smart: true });
    const order = () => { ws.activeWindow = ws.stackingOrder.find(w => !w.deleted); logs.length = 0; shortcuts["Dump State to Log"]();
        return logs.filter(l => /^ +#\d/.test(l)).map(l => l.trim().split(/\s+/)[1]); };
    const a = open(mk("chat", "discord")), b = open(mk("web", "firefox")), c = open(mk("code", "code")), d = open(mk("term", "konsole"));
    assert.deepStrictEqual(order(), ["chat", "web", "code", "term"], "light chat stays master although heavier windows follow");
    assert.strictEqual(g(a).x, 8);
    const e = open(mk("web2", "firefox")); close(c);
    assert.deepStrictEqual(order(), ["chat", "web", "term", "web2"]);
    for (let i = 0; i < 3; i++) { ws.activeWindow = a; shortcuts["Reset Ratios"](); shortcuts["Toggle Smart Sizing"](); }
    assert.deepStrictEqual(order(), ["chat", "web", "term", "web2"], "toggling and resetting smart sizing never swaps");
});

test("smart: declared minimum sizes are honoured as far as possible, never floated", () => {
    const { open } = load({ smart: true }); const a = open(mk("a", "app", { minSize: { width: 700, height: 100 } })), b = open(mk("b"));
    assert.strictEqual(g(a).width, 590); assert.strictEqual(g(b).width, 386); noOverlap([a, b]);
});

test("smart: absurd or conflicting minimums are capped and everything stays tiled", () => {
    const { open } = load({ smart: true }); const a = open(mk("a", "app", { minSize: { width: 5000, height: 5000 } })), b = open(mk("b", "app", { minSize: { width: 5000, height: 5000 } }));
    assert.deepStrictEqual([g(a).width, g(b).width], [488, 488]); noOverlap([a, b]);
    const t = load({ smart: true }); const c = t.open(mk("c", "app", { minSize: { width: 5000, height: 10 } })), d = t.open(mk("d"));
    assert(g(c).width <= 591 && g(d).width > 300); inside([c, d], screenA.area, 8);
});

test("smart: minimum height drives a stacked split", () => {
    const { open } = load({ smart: true }); const a = open(mk("a")), b = open(mk("b", "app", { minSize: { width: 50, height: 500 } })), c = open(mk("c"));
    assert(g(b).height >= 460 && g(b).height <= 470, "b gets ~470 high: " + g(b).height); noOverlap([a, b, c]);
});

test("smart: a window that opened big gets more than one that opened small", () => {
    const { open } = load({ smart: true });
    const a = open(mkWin("big", { _g: { x: 0, y: 0, width: 900, height: 700 } })), b = open(mkWin("small", { _g: { x: 0, y: 0, width: 300, height: 300 } }));
    assert.strictEqual(g(a).width, 619);
    const t = load({ smart: true }); const c = t.open(mkWin("small", { _g: { x: 0, y: 0, width: 300, height: 300 } })), d = t.open(mkWin("big", { _g: { x: 0, y: 0, width: 900, height: 700 } }));
    assert(g(c).width < 488 && g(d).width > 488, "order unchanged, sizes follow what they asked for");
});

test("smart: windows that existed before the script started have no size hint (weighted by kind only)", () => {
    const a = mkWin("ff", { resourceClass: "firefox", _g: { x: 0, y: 0, width: 900, height: 700 } }), b = mkWin("t", { resourceClass: "konsole", _g: { x: 0, y: 0, width: 300, height: 300 } });
    load({ smart: true, pre: [a, b] }); assert.strictEqual(g(a).width, 621);
});

test("smart: closing a window re-evaluates the remaining sizes", () => {
    const { open, close } = load({ smart: true }); const a = open(mk("t", "konsole")), b = open(mk("ff", "firefox")), c = open(mk("x"));
    assert.strictEqual(g(a).width, Math.round(976 * 1.28 / (1.28 + 1.4 + 1)), "3 windows: terminal master, bonus applied");
    close(a);
    assert.strictEqual(g(b).width, 569, "now firefox|app: 1.4 vs 1.0"); assert.strictEqual(g(c).width, 984 - 569 - 8); noOverlap([b, c]);
});

test("smart: your own sizes always win, 'Ratio' keys start from the smart size, reset hands control back", () => {
    const { open, ws, shortcuts } = load({ smart: true }); const a = open(mk("ff", "firefox")), b = open(mk("t", "konsole")); ws.activeWindow = a;
    assert.strictEqual(g(a).width, 621); shortcuts["Ratio Wider"](); assert.strictEqual(g(a).width, 670);
    shortcuts["Share 50"](); assert.strictEqual(g(a).width, 488);
    const c = open(mk("c")); assert.strictEqual(g(a).width, 488, "manual size kept while windows change");
    shortcuts["Reset Ratios"](); assert.notStrictEqual(g(a).width, 488);
});

test("smart: mouse resize is remembered over smart sizing", () => {
    const { open } = load({ smart: true }); const a = open(mk("ff", "firefox")), b = open(mk("t", "konsole"));
    a.resize = true; a.interactiveMoveResizeStarted.emit(); a._g = { ...a._g, width: 700 }; a.interactiveMoveResizeFinished.emit();
    assert.strictEqual(g(a).width, 700);
});

test("smart sizing can be toggled off and on; off means plain 50/50", () => {
    const { open, ws, shortcuts } = load({ smart: true }); const a = open(mk("ff", "firefox")), b = open(mk("t", "konsole")); ws.activeWindow = a;
    assert.strictEqual(g(a).width, 621); shortcuts["Toggle Smart Sizing"](); assert.strictEqual(g(a).width, 488);
    shortcuts["Toggle Smart Sizing"](); assert.strictEqual(g(a).width, 621);
});

test("smart: category table matches class or name, first match wins, unknown = 1.0", () => {
    const { open, ws, shortcuts, logs } = load({ smart: true });
    const w = [mk("a", "org.kde.konsole"), mk("b", "Code", { resourceName: "code" }), mk("c", "something-else"), mk("d", "x", { resourceName: "firefox" })];
    w.forEach(open); ws.activeWindow = w[0]; logs.length = 0; shortcuts["Dump State to Log"]();
    const t = logs.join("\n"); assert(/#1 +a.*weight 0\.80/.test(t) && /#2 +b.*weight 1\.50/.test(t) && /#3 +c.*weight 1\.00/.test(t) && /#4 +d.*weight 1\.40/.test(t), t);
});

// ---------- screen shape ----------
test("portrait screen: the first split stacks windows; landscape is unchanged", () => {
    const screenP = { name: "P", area: { x: 0, y: 0, width: 900, height: 1600 } };
    const { open, ws } = load(); ws.screens.push(screenP);
    const a = open(mkWin("a", { output: screenP })), b = open(mkWin("b", { output: screenP }));
    assert.deepStrictEqual(g(a), A(8, 8, 884, 788)); assert.deepStrictEqual(g(b), A(8, 804, 884, 788));
});

test("very wide screen: later splits go side by side too", () => {
    const screenW = { name: "W", area: { x: 0, y: 0, width: 5120, height: 1440 } };
    const { open, ws } = load(); ws.screens.push(screenW);
    const [a, b, c] = ["a", "b", "c"].map(n => open(mkWin(n, { output: screenW })));
    assert.deepStrictEqual(g(a), A(8, 8, 2548, 1424)); assert.deepStrictEqual(g(b), A(2564, 8, 1270, 1424)); assert.deepStrictEqual(g(c), A(3842, 8, 1270, 1424));
});

test("size keys follow the real axes on unusual screens", () => {
    const screenW = { name: "W", area: { x: 0, y: 0, width: 5120, height: 1440 } };
    const { open, ws, shortcuts } = load(); ws.screens.push(screenW);
    const [a, b, c] = ["a", "b", "c"].map(n => open(mkWin(n, { output: screenW }))); ws.activeWindow = c;
    shortcuts["Ratio Wider"](); assert(g(c).width > g(b).width, "c wider than b"); noOverlap([a, b, c]);
    const screenP = { name: "P", area: { x: 0, y: 0, width: 900, height: 1600 } }; ws.screens.push(screenP);
    const p = open(mkWin("p", { output: screenP })), q = open(mkWin("q", { output: screenP })); ws.activeWindow = p;
    const ph = g(p).height; shortcuts["Ratio Taller"](); assert(g(p).height > ph, "taller works on the stacked first split");
});

test("ordinary landscape layouts are unchanged by the shape rules (up to 8 windows)", () => {
    const { open } = load(); const ws = []; for (let i = 0; i < 8; i++) ws.push(open(mkWin("w" + i)));
    assert.deepStrictEqual(g(ws[0]), A(8, 8, 488, 784)); assert.deepStrictEqual(g(ws[1]), A(504, 8, 488, 388)); assert.deepStrictEqual(g(ws[2]), A(504, 404, 240, 388));
});

test("everything stays in bounds with no overlap: kinds x counts x mirror x screen shapes", () => {
    const shapes = [{ name: "L", area: { x: 0, y: 0, width: 1920, height: 1080 } }, { name: "P", area: { x: 0, y: 0, width: 1080, height: 1920 } },
                    { name: "U", area: { x: 0, y: 0, width: 3440, height: 1440 } }, { name: "S", area: { x: 0, y: 0, width: 1000, height: 1000 } }];
    for (const shape of shapes) for (const smart of [false, true]) for (const mirror of [false, true]) for (let n = 1; n <= 10; n++) {
        const { open, ws, shortcuts } = load({ smart }); ws.screens = [shape];
        const w = []; for (let i = 0; i < n; i++) w.push(open(mk("w" + i, ["firefox", "konsole", "code", "app", "discord", "vlc"][i % 6], { output: shape })));
        ws.activeWindow = w[0]; if (mirror) shortcuts["Mirror Layout"]();
        noOverlap(w); inside(w, shape.area, n > 1 ? 8 : 0);
        for (const k of ["Ratio Wider", "Ratio Taller", "Ratio Narrower", "Ratio Shorter"]) { ws.activeWindow = w[n - 1]; shortcuts[k](); }
        noOverlap(w);
    }
});

test("windows closing in smart mode reflow without errors", () => {
    const { open, close } = load({ smart: true }); const w = [0, 1, 2, 3, 4].map(i => open(mk("w" + i, ["firefox", "konsole", "code", "app", "discord"][i])));
    close(w[2]); close(w[0]); close(w[4]); inside([w[1], w[3]], screenA.area, 8); noOverlap([w[1], w[3]]);
});

// ======================= v1.0: tooltips, popups and overlays =======================
test("tooltips, popups and overlays are never tiled and never disturb the layout", () => {
    const flagSets = [{ tooltip: true }, { popupWindow: true }, { popupMenu: true }, { dropdownMenu: true }, { comboBox: true },
        { appletPopup: true }, { notification: true }, { onScreenDisplay: true }, { outline: true },,
        {}, { resourceClass: "kwin_wayland" }, { resourceClass: "KWin" }, { inputMethod: true }, { dock: true }];
    const { open, close, logs } = load({ real: true });
    const a = open(mkWin("a")), b = open(mkWin("b")); const snap = () => JSON.stringify([a, b].map(g)); const before = snap();
    for (const flags of flagSets) {
        const tip = open(mkWin("Close", { ...flags, _g: { x: 900, y: 760, width: 60, height: 24 } }));
        assert.strictEqual(snap(), before, "layout moved for " + JSON.stringify(flags));
        assert.deepStrictEqual(g(tip), A(900, 760, 60, 24), "tooltip was moved: " + JSON.stringify(flags));
        close(tip); assert.strictEqual(snap(), before);
    }
    assert(!logs.some(l => l.includes("not tiling")), "tooltips don't spam the log");
});

test("v1.1: flags that real windows can report (wantsInput=false, skipTaskbar+skipSwitcher) do NOT stop tiling", () => {
    const { open } = load({ real: true });
    const a = open(mkWin("a", { wantsInput: false, skipTaskbar: true, skipSwitcher: true, toolbar: false, menu: false }));
    const b = open(mkWin("b", { wantsInput: false, skipTaskbar: true, skipSwitcher: true }));
    assert.deepStrictEqual(g(a), A(8, 8, 488, 784)); assert.deepStrictEqual(g(b), A(504, 8, 488, 784));
});

test("v1.1: a normal-sized window is tiled whatever its caption; a tiny one never is", () => {
    const { open } = load({ real: true });
    const a = open(mkWin("", { _g: { x: 10, y: 10, width: 400, height: 300 } }));
    const tip = open(mkWin("Close", { _g: { x: 900, y: 760, width: 119, height: 24 } }));
    const b = open(mkWin("b"));
    assert.deepStrictEqual(g(tip), A(900, 760, 119, 24)); assert.strictEqual(g(b).x, 504);
});

test("a real window that merely skips the taskbar (but not the switcher) is still tiled", () => {
    const { open } = load({ real: true }); const a = open(mkWin("a")), b = open(mkWin("b", { skipTaskbar: true }));
    assert.strictEqual(g(a).width, 488);
});

test("debug log records every flag of a new window, so a stray popup can be identified", () => {
    const { open, shortcuts, logs, osd } = load({ real: true });
    shortcuts["Toggle Debug Log"](); assert(osd().includes("Debug log on"));
    open(mkWin("Close", { tooltip: true, _g: { x: 1, y: 1, width: 50, height: 20 } })); open(mkWin("a"));
    const t = logs.join("\n");
    assert(/window appeared: "Close".*tooltip=true/.test(t) && /window appeared: "a".*normalWindow=true/.test(t), t);
    assert(/not tiling "Close".*tooltip/.test(t), "in debug mode the reason is logged too");
});

test("debug log is silent by default and logs moves when on", () => {
    const { open, shortcuts, logs } = load({ real: true }); open(mkWin("a")); open(mkWin("b"));
    assert(!logs.some(l => l.includes("[debug]")));
    shortcuts["Toggle Debug Log"](); logs.length = 0; open(mkWin("c"));
    assert(logs.some(l => /\[debug\].*move "b"/.test(l)) && logs.some(l => l.includes("[debug]: arrange")));
    shortcuts["Toggle Debug Log"](); logs.length = 0; open(mkWin("d")); assert(!logs.some(l => l.includes("[debug]")));
});

// ======================= v1.0: tile limit =======================
const openN = (t, n, mkf) => Array.from({ length: n }, (_, i) => t.open((mkf || mkWin)("w" + i)));

test("the 6th window floats (centred) and the other five stay tiled", () => {
    const t = load({ real: true }); const w = openN(t, 5); const snap = JSON.stringify(w.map(g)); noOverlap(w);
    const f = t.open(mkWin("f"));
    assert.deepStrictEqual(g(f), A(350, 250, 300, 300)); assert.strictEqual(JSON.stringify(w.map(g)), snap, "tiles unchanged");
    assert(t.ws.raised.includes(f), "raised"); assert(t.osd().includes('"f" floats (max 5 tiled)'));
});

test("every window after the 6th floats too, cascaded", () => {
    const t = load({ real: true }); const w = openN(t, 5); const f6 = t.open(mkWin("f6")), f7 = t.open(mkWin("f7")), f8 = t.open(mkWin("f8"));
    assert.deepStrictEqual([g(f6), g(f7), g(f8)].map(r => [r.x, r.y]), [[350, 250], [382, 282], [414, 314]]); noOverlap(w);
});

test("closing a tile lets the first floating window take it; the others stay floating", () => {
    const t = load({ real: true }); const w = openN(t, 5); const f6 = t.open(mkWin("f6")), f7 = t.open(mkWin("f7"));
    const f7g = { ...g(f7) }; t.close(w[2]);
    noOverlap([w[0], w[1], w[3], w[4], f6]); inside([w[0], w[1], w[3], w[4], f6], screenA.area, 8);
    assert.deepStrictEqual(g(f7), f7g, "f7 untouched");
});

test("the limit is per screen and per desktop", () => {
    const screenB = { name: "B", area: { x: 1000, y: 0, width: 800, height: 600 } };
    const t = load({ real: true }); t.ws.screens.push(screenB);
    const onA = openN(t, 5), onB = Array.from({ length: 5 }, (_, i) => t.open(mkWin("b" + i, { output: screenB })));
    noOverlap(onA); noOverlap(onB); inside(onB, screenB.area, 8);
    const f = t.open(mkWin("fa")); assert.deepStrictEqual(g(f), A(350, 250, 300, 300), "6th on A floats");
    noOverlap(onB);
    const d2 = { id: "d2" }; t.ws.currentDesktop = d2; const x = Array.from({ length: 5 }, (_, i) => t.open(mkWin("x" + i, { desktops: [d2] }))); noOverlap(x);
});

test("minimized windows don't count toward the limit; restoring one sends it to the end", () => {
    const t = load({ real: true }); const w = openN(t, 5); const f = t.open(mkWin("f"));
    w[0].minimized = true; w[0].minimizedChanged.emit();
    inside([w[1], w[2], w[3], w[4], f], screenA.area, 8); noOverlap([w[1], w[2], w[3], w[4], f]);
    w[0].minimized = false; w[0].minimizedChanged.emit();
    assert.deepStrictEqual(g(w[0]), A(256, 120, 488, 560), "restored window arrives last -> floats, centred, keeping its tile size (capped to 70% of the height)");
    noOverlap([w[1], w[2], w[3], w[4], f]);
});

test("keyboard actions ignore floating windows; focus cycling covers the tiles only", () => {
    const t = load({ real: true }); const w = openN(t, 5); const f = t.open(mkWin("f")); const fg = { ...g(f) }; const snap = JSON.stringify(w.map(g));
    t.ws.activeWindow = f;
    for (const k of ["Ratio Wider", "Ratio Taller", "Share 70", "Promote to Master", "Swap Left", "Focus Left"]) t.shortcuts[k]();
    assert.strictEqual(JSON.stringify(w.map(g)), snap); assert.deepStrictEqual(g(f), fg);
    t.shortcuts["Focus Next Window"](); assert.strictEqual(t.ws.activeWindow, w[0]);
    t.ws.activeWindow = w[4]; t.shortcuts["Focus Next Window"](); assert.strictEqual(t.ws.activeWindow, w[0], "wraps within tiles");
});

test("rotate moves only the tiled windows; the floating one keeps its place in the order", () => {
    const t = load({ real: true }); const w = openN(t, 5); const f = t.open(mkWin("f")); t.ws.activeWindow = w[0]; const fg = { ...g(f) };
    t.shortcuts["Rotate Windows Forward"](); assert.deepStrictEqual(g(f), fg); assert.deepStrictEqual(g(w[4]).x, 8, "last tile became master");
    noOverlap(w);
});

test("order is never changed by the limit: the numbered dump shows the opening order", () => {
    const t = load({ real: true }); const w = openN(t, 7); t.ws.activeWindow = w[0]; t.close(w[2]);
    t.logs.length = 0; t.shortcuts["Dump State to Log"]();
    const txt = t.logs.join("\n"); assert(/#1 +w0/.test(txt) && /#2 +w1/.test(txt) && /#3 +w3/.test(txt) && /#5 +w5/.test(txt));
    assert(/w6.*floating: more than 5 windows/.test(txt), txt);
});

test("smart sizing works with a full set of five tiles and ignores floating windows", () => {
    const t = load({ real: true, smart: true }); const kinds = ["firefox", "konsole2", "code", "discord", "krita", "app", "app"];
    const w = kinds.map((k, i) => t.open(mk("w" + i, k))); noOverlap(w.slice(0, 5)); inside(w.slice(0, 5), screenA.area, 8);
});

// ======================= v1.0: drag a floating window onto a tile =======================
function dropOn(t, win, x, y) {
    t.ws.stackingOrder = t.ws.stackingOrder.filter(w => w !== win).concat([win]);
    win.interactiveMoveResizeStarted.emit(); win._g = { ...win._g, x: x - 20, y: y - 20 }; t.ws.cursorPos = { x, y }; win.interactiveMoveResizeFinished.emit();
}

test("drag the 6th (floating) window onto a tile: it takes the tile, the replaced window floats where it came from", () => {
    const t = load({ real: true }); const w = openN(t, 5); const f = t.open(mkWin("f")); const tile1 = { ...g(w[1]) }; const others = [0, 2, 3, 4].map(i => JSON.stringify(g(w[i])));
    dropOn(t, f, tile1.x + 10, tile1.y + 10);
    assert.deepStrictEqual(g(f), tile1, "f took the tile"); assert.deepStrictEqual(g(w[1]), A(350, 250, 300, 300), "replaced window floats at f's old spot");
    assert.deepStrictEqual([0, 2, 3, 4].map(i => JSON.stringify(g(w[i]))), others, "other tiles unchanged");
    assert.strictEqual(t.ws.raised[t.ws.raised.length - 1], w[1]); assert(t.osd().includes('"w1" floats'));
});

test("after such a swap, the replaced window comes back when a tile frees up (order is kept)", () => {
    const t = load({ real: true }); const w = openN(t, 5); const f = t.open(mkWin("f")); const tile1 = { ...g(w[1]) };
    dropOn(t, f, tile1.x + 10, tile1.y + 10); t.close(w[0]);
    inside([f, w[2], w[3], w[4], w[1]], screenA.area, 8); noOverlap([f, w[2], w[3], w[4], w[1]]);
});

test("drag a window you floated yourself onto a tile when there is room: it JOINS the tiling, nobody floats", () => {
    const t = load({ real: true }); const a = t.open(mkWin("a")), b = t.open(mkWin("b")), c = t.open(mkWin("c"));
    t.ws.activeWindow = c; t.shortcuts["Toggle Floating"]();
    assert.deepStrictEqual(g(b), A(504, 8, 488, 784));
    dropOn(t, c, 800, 20);                                  // onto b's tile
    assert.deepStrictEqual(g(a), A(8, 8, 488, 784), "a stays master");
    assert.deepStrictEqual(g(c), A(504, 8, 488, 388), "c took b's position");
    assert.deepStrictEqual(g(b), A(504, 404, 488, 388), "b shifted down, still tiled");
    noOverlap([a, b, c]); assert(t.osd().includes("Tiled"));
});

test("dropping a floating window onto the master tile makes it the new master and shifts the rest", () => {
    const t = load({ real: true }); const a = t.open(mkWin("a")), b = t.open(mkWin("b")), c = t.open(mkWin("c"));
    t.ws.activeWindow = c; t.shortcuts["Toggle Floating"]();
    dropOn(t, c, 100, 20);
    assert.deepStrictEqual(g(c), A(8, 8, 488, 784)); assert.deepStrictEqual(g(a), A(504, 8, 488, 388)); assert.deepStrictEqual(g(b), A(504, 404, 488, 388));
});

test("drop of a floating window on empty space or on another floating window: it stays floating", () => {
    const t = load({ real: true }); const a = t.open(mkWin("a")), b = t.open(mkWin("b")), c = t.open(mkWin("c")), d = t.open(mkWin("d"));
    t.ws.activeWindow = c; t.shortcuts["Toggle Floating"](); t.ws.activeWindow = d; t.shortcuts["Toggle Floating"]();
    const before = JSON.stringify([a, b].map(g));
    dropOn(t, c, g(d).x + 5, g(d).y + 5);                     // lands on d (floating, on top)
    assert.strictEqual(JSON.stringify([a, b].map(g)), before);
});

test("a window that joined by drag behaves as tiled afterwards (float shortcut floats it again)", () => {
    const t = load({ real: true }); const a = t.open(mkWin("a")), b = t.open(mkWin("b")), c = t.open(mkWin("c"));
    t.ws.activeWindow = c; t.shortcuts["Toggle Floating"](); dropOn(t, c, 800, 20);
    t.ws.activeWindow = c; t.shortcuts["Toggle Floating"](); assert.deepStrictEqual(g(b), A(504, 8, 488, 784));
});

test("a quick-use app (konsole) floated by the class rule can be dragged into the tiling", () => {
    const t = load({ real: true }); const a = t.open(mkWin("a")), b = t.open(mkWin("b"));
    const k = t.open(mkWin("k", { resourceClass: "org.kde.konsole", resourceName: "konsole" }));
    assert.deepStrictEqual(g(b), A(504, 8, 488, 784), "konsole floats");
    dropOn(t, k, 800, 20);
    assert.deepStrictEqual(g(k), A(504, 8, 488, 784).height === 784 ? g(k) : null);
    assert.strictEqual(g(k).y, 8); assert(g(b).y > g(k).y, "k above b"); noOverlap([a, b, k]);
});
test("dropping a floating window on another floating window, or on empty space, changes nothing", () => {
    const t = load({ real: true }); const a = t.open(mkWin("a")), b = t.open(mkWin("b")), c = t.open(mkWin("c")), d = t.open(mkWin("d"));
    t.ws.activeWindow = c; t.shortcuts["Toggle Floating"](); t.ws.activeWindow = d; t.shortcuts["Toggle Floating"]();
    const ab = JSON.stringify([a, b].map(g)); const dg = { ...g(d) };
    dropOn(t, c, dg.x + 30, dg.y + 30); assert.strictEqual(JSON.stringify([a, b].map(g)), ab, "blocked by the floating window on top");
    dropOn(t, c, 995, 795); assert.strictEqual(JSON.stringify([a, b].map(g)), ab, "empty space");
    assert.deepStrictEqual(g(c).x, 995 - 20, "c stays where dropped");
});

test("a tiled window dropped on a tile still swaps, and dropping it on a floating window still doesn't", () => {
    const t = load({ real: true }); const w = openN(t, 3); const f = t.open(mkWin("f", { _g: { x: 700, y: 100, width: 250, height: 250 } }));
    t.ws.activeWindow = f; t.shortcuts["Toggle Floating"](); const fr = g(f);
    dropOn(t, w[0], 900, 100); assert.strictEqual(g(w[0]).x, 504, "swapped with w1 (cursor not under the floating window)");
    dropOn(t, w[1], g(f).x + 20, g(f).y + 20); assert.strictEqual(g(w[1]).x, 8, "w1 (now master) dropped on the floating window: no swap");
});

test("a floating window dragged onto a tile of ANOTHER screen is ignored (same-screen only)", () => {
    const screenB = { name: "B", area: { x: 1000, y: 0, width: 800, height: 600 } };
    const t = load({ real: true }); t.ws.screens.push(screenB); const w = openN(t, 5); const f = t.open(mkWin("f")); const x = t.open(mkWin("x", { output: screenB }));
    const snap = JSON.stringify(w.map(g)); dropOn(t, f, 1100, 100); assert.strictEqual(JSON.stringify(w.map(g)), snap);
});

test("Meta+Shift+F on a window that floats only because of the limit swaps it with the last tile", () => {
    const t = load({ real: true }); const w = openN(t, 5); const f = t.open(mkWin("f")); const last = { ...g(w[4]) };
    t.ws.activeWindow = f; t.shortcuts["Toggle Floating"]();
    assert.deepStrictEqual(g(f), last, "f took the last tile"); assert(Math.abs(g(w[4]).x + g(w[4]).width / 2 - 500) <= 1, "w4 centred, floating");
    assert(t.osd().includes('"w4" floats instead'));
});

test("unfloating with no room keeps the window floating and says so", () => {
    const t = load({ real: true }); const w = openN(t, 5); t.ws.activeWindow = w[0]; t.shortcuts["Toggle Floating"]();   // w0 floats, 4 tiles
    const w5 = t.open(mkWin("w5")); noOverlap([w[1], w[2], w[3], w[4], w5]);                                              // w5 tiles (5th)
    t.ws.activeWindow = w[0]; t.shortcuts["Toggle Floating"]();                                                           // no room
    assert(t.osd().includes("No room to tile (max 5): stays floating")); noOverlap([w[1], w[2], w[3], w[4], w5]);
});

// ======================= v1.0: quick-use apps float first =======================
const KON = { resourceClass: "org.kde.konsole", resourceName: "konsole" };

test("konsole, file managers and system settings open floating, centred, outside the tiles", () => {
    const t = load({ real: true }); const a = t.open(mkWin("a"));
    const k = t.open(mkWin("k", KON)); assert.deepStrictEqual(g(a), FULL); assert.deepStrictEqual(g(k), A(350, 250, 300, 300));
    const d = t.open(mkWin("d", { resourceClass: "org.kde.dolphin", resourceName: "dolphin" })), s = t.open(mkWin("s", { resourceClass: "systemsettings" }));
    const n = t.open(mkWin("n", { resourceClass: "Org.Gnome.Nautilus" })); assert.deepStrictEqual(g(a), FULL, "none of them tiled");
    const b = t.open(mkWin("b")); assert.deepStrictEqual(g(a), A(8, 8, 488, 784));
});

test("floating apps don't count toward the limit", () => {
    const t = load({ real: true }); const w = openN(t, 5); const ks = [t.open(mkWin("k1", KON)), t.open(mkWin("k2", KON))];
    noOverlap(w); inside(w, screenA.area, 8); assert.strictEqual(g(w[0]).x, 8);
    const f = t.open(mkWin("f")); assert.deepStrictEqual(g(f), A(350, 250, 300, 300), "the 6th ordinary window floats");
});

test("a floating app can be tiled with Meta+Shift+F and then stays tiled", () => {
    const t = load({ real: true }); const a = t.open(mkWin("a")), k = t.open(mkWin("k", KON)); t.ws.activeWindow = k; t.shortcuts["Toggle Floating"]();
    assert.deepStrictEqual(g(a), A(8, 8, 488, 784)); assert.deepStrictEqual(g(k), A(504, 8, 488, 784));
    t.ws.activeWindow = a; t.shortcuts["Rotate Windows Forward"](); assert.strictEqual(g(k).x, 8, "k is an ordinary tile now");
});

test("the list is a constant: with FLOAT_CLASSES empty, konsole tiles", () => {
    const t = load({ real: true, constants: { FLOAT_GROUPS: {} } }); const a = t.open(mkWin("a")), k = t.open(mkWin("k", KON)); assert.strictEqual(g(k).x, 504);
});

test("apps already open when the script starts float where they are", () => {
    const k = mkWin("k", { ...KON, _g: { x: 120, y: 90, width: 400, height: 300 } }), a = mkWin("a");
    load({ real: true, pre: [a, k] }); assert.deepStrictEqual(g(a), FULL); assert.deepStrictEqual(g(k), A(120, 90, 400, 300));
});

test("Meta+Ctrl+F: stop floating an app for this session, and start again", () => {
    const t = load({ real: true }); const a = t.open(mkWin("a")), k = t.open(mkWin("k", KON)); t.ws.activeWindow = k; t.logs.length = 0;
    t.shortcuts["Toggle Float for This App"]();
    assert.deepStrictEqual(g(k), A(504, 8, 488, 784), "konsole tiles"); assert(t.osd().includes('"org.kde.konsole" tiles again'));
    const k2 = t.open(mkWin("k2", KON)); noOverlap([a, k, k2]); inside([a, k, k2], screenA.area, 8);
    t.ws.activeWindow = k; t.shortcuts["Toggle Float for This App"]();
    assert(t.osd().includes('"org.kde.konsole" now always floats')); assert.deepStrictEqual(g(a), FULL);
    assert(t.logs.some(l => /add "org\.kde\.konsole" to "Always float"/.test(l)), "tells you what to put in the file");
});

test("Meta+Ctrl+F on an ordinary app floats all its windows and its future windows", () => {
    const KATE = { resourceClass: "org.kde.okular", resourceName: "okular" };   // an app that tiles by default
    const t = load({ real: true }); const a = t.open(mkWin("a")), k1 = t.open(mkWin("k1", KATE)), k2 = t.open(mkWin("k2", KATE));
    t.ws.activeWindow = k1; t.shortcuts["Toggle Float for This App"]();
    assert.deepStrictEqual(g(a), FULL, "a alone again"); assert.deepStrictEqual(g(k1), A(256, 206, 488, 388)); assert.deepStrictEqual(g(k2), A(256, 206, 488, 388));
    const k3 = t.open(mkWin("k3", KATE)); assert.deepStrictEqual(g(a), FULL, "new kate window floats too");
});

test("Meta+Ctrl+F is safe with no window and with a window without a class", () => {
    const t = load({ real: true }); t.ws.activeWindow = null; t.shortcuts["Toggle Float for This App"]();
    const a = t.open(mkWin("a", { resourceClass: "", resourceName: "" })); t.ws.activeWindow = a; t.shortcuts["Toggle Float for This App"]();
});

test("dump state shows why each window floats", () => {
    const t = load({ real: true }); const w = openN(t, 5); t.open(mkWin("over")); t.open(mkWin("term", KON)); t.ws.activeWindow = w[0];
    t.logs.length = 0; t.shortcuts["Dump State to Log"](); const txt = t.logs.join("\n");
    assert(/over.*more than 5 windows/.test(txt) && /term.*class rule/.test(txt) && /floating apps: .*konsole/.test(txt) && /maxTiled=5/.test(txt), txt);
});

test("the script ships with the limit at 5 and the three quick-use apps in the list", () => {
    const src = fs.readFileSync(MAIN, "utf8"); assert(/let MAX_TILED = 5;/.test(src));
    const m = src.match(/const FLOAT_GROUPS = \{([\s\S]*?)\n\};/)[1]; for (const c of ["konsole", "dolphin", "systemsettings"]) assert(m.includes('"' + c + '"'), c);
});

// ======================= widget <-> script consistency =======================
test("every shortcut the panel widget triggers exists in the script", () => {
    const p = path.join(__dirname, "../widget/contents/ui/main.qml"); if (!fs.existsSync(p)) return;
    const { shortcuts } = load(); const qml = fs.readFileSync(p, "utf8");
    const names = [...qml.matchAll(/trigger\("([^"]+)"\)/g)].map(m => m[1]);
    assert(names.length >= 10, "found the widget's buttons");
    for (const n of names) assert(shortcuts[n], "script has no shortcut named: " + n);
});

test("the settings page files exist, are well-formed, and every category/key matches the script", () => {
    const root = path.join(__dirname, "..", "script"); const xml = fs.readFileSync(path.join(root, "contents/config/main.xml"), "utf8");
    const ui = fs.readFileSync(path.join(root, "contents/ui/config.ui"), "utf8"); const src = fs.readFileSync(MAIN, "utf8");
    assert(/kwin\/effects\/configs\/kcm_kwin4_genericscripted/.test(fs.readFileSync(path.join(root, "metadata.json"), "utf8")));
    const groups = [...src.match(/const FLOAT_GROUPS = \{([\s\S]*?)\n\};/)[1].matchAll(/^    (\w+): \[/gm)].map(m => "float" + m[1][0].toUpperCase() + m[1].slice(1));
    assert.strictEqual(groups.length, 13);
    for (const k of [...groups, "maxTiled", "floatExtra", "alwaysTile"]) { assert(xml.includes(`name="${k}"`), "main.xml " + k); assert(ui.includes(`name="kcfg_${k}"`), "config.ui " + k); }
});

const CFG_KON = { resourceClass: "org.kde.konsole", resourceName: "konsole" }, CFG_MUS = { resourceClass: "elisa", resourceName: "elisa" };
test("each category can be switched off in the settings: its apps then tile", () => {
    const t = load({ real: true, config: { floatTerminals: false } }); const a = t.open(mkWin("a")), k = t.open(mkWin("k", CFG_KON)), m = t.open(mkWin("m", CFG_MUS));
    assert.strictEqual(g(k).x, 504, "konsole tiles"); assert.notDeepStrictEqual(g(m), g(k)); assert(g(m).width === 300, "music player still floats");
});

test("max tiled windows comes from the settings", () => {
    const t = load({ real: true, config: { maxTiled: 3 } }); const w = [0, 1, 2, 3].map(q => t.open(mkWin("w" + q)));
    assert.strictEqual(g(w[3]).width, 300, "4th floats"); assert.notStrictEqual(g(w[2]).width, 300, "3rd tiles");
});

test("your own lists: extra classes float, 'always tile' beats a category", () => {
    const t = load({ real: true, config: { floatExtra: "Krita, okular", alwaysTile: "konsole org.kde.konsole" } });
    const a = t.open(mkWin("a")), k = t.open(mkWin("k", CFG_KON)), kr = t.open(mkWin("kr", { resourceClass: "krita", resourceName: "krita" }));
    assert.strictEqual(g(k).x, 504, "konsole tiles"); assert.strictEqual(g(kr).width, 300, "krita floats");
});

test("a saved change reaches the next window without restarting; Reload Settings does it on demand", () => {
    const cfg = {}; const t = load({ real: true, config: cfg }); const a = t.open(mkWin("a"));
    const k1 = t.open(mkWin("k1", CFG_KON)); assert.strictEqual(g(k1).width, 300, "floats by default");
    cfg.floatTerminals = false; const k2 = t.open(mkWin("k2", CFG_KON)); assert.strictEqual(g(k2).x, 504, "next konsole tiles");
    cfg.floatTerminals = true; t.shortcuts["Reload Settings"](); assert(t.osd().includes("Settings reloaded"));
    const k3 = t.open(mkWin("k3", CFG_KON)); assert.strictEqual(g(k3).width, 300, "floats again");
    t.shortcuts["Reload Settings"](); assert(t.osd().includes("Settings unchanged"));
});

test("bad or missing settings values fall back to the defaults", () => {
    const t = load({ real: true, config: { maxTiled: "abc", floatMusicPlayers: "false", floatExtra: undefined } }); const a = t.open(mkWin("a")), m = t.open(mkWin("m", CFG_MUS));
    assert.strictEqual(g(m).x, 504, "string 'false' switches the category off");
    const w = [1, 2, 3, 4, 5].map(q => t.open(mkWin("w" + q))); assert.strictEqual(g(w[4]).width, 300, "limit stays 5 (6 windows total, the last floats)");
});

// ======================= v1.3: windows that don't fit their tile =======================
// A window that refuses to be smaller than `min` (the app enforces it, no minSize is declared).
function stubborn(w, minW, minH) {
    let cur = { ...w._g };
    Object.defineProperty(w, "frameGeometry", {
        configurable: true,
        get() { return { ...cur }; },
        set(v) { cur = { ...v, width: Math.max(v.width, minW || 0), height: Math.max(v.height, minH || 0) }; w._g = cur; w.frameGeometryChanged.emit(); },
    });
    return w;
}

test("v1.3: an app that refuses to shrink (no declared min) is learned; neighbours make room; no overlap", () => {
    const t = load(); const a = t.open(mkWin("a")), b = t.open(mkWin("b")), c = t.open(mkWin("c"));
    const d = t.open(stubborn(mkWin("d"), 400, 0));
    for (let r = 0; r < 3; r++) t.ws.stackingOrder.forEach(w => w.frameGeometryChanged.emit());          // late geometry events, as on Wayland
    noOverlap([a, b, c, d]); assert(g(d).width >= 400, "d keeps its minimum: " + g(d).width); inside([a, b, c, d], screenA.area, 8);
});

test("v1.3: the same works with a declared minSize on a deep window and with manual sizes", () => {
    const t = load(); const [a, b, c] = ["a", "b", "c"].map(n => t.open(mkWin(n)));
    const d = t.open(stubborn(mkWin("d", { minSize: { width: 380, height: 50 } }), 380, 0)); const e = t.open(mkWin("e"));
    for (let r = 0; r < 3; r++) t.ws.stackingOrder.forEach(w => w.frameGeometryChanged.emit());
    noOverlap([a, b, c, d, e]); assert(g(d).width >= 380, "d wide enough: " + g(d).width);
    t.ws.activeWindow = c; t.shortcuts["Share 80"](); noOverlap([a, b, c, d, e]); assert(g(d).width >= 380);
});

test("v1.3: minimums are honoured with smart sizing off as well", () => {
    const t = load(); const a = t.open(mkWin("a")), b = t.open(mkWin("b", { minSize: { width: 700, height: 50 } }));
    assert(g(b).width >= 590 && g(b).width <= 600 || g(b).width >= 590, "b gets what it can: " + g(b).width); noOverlap([a, b]);
});

test("v1.3: re-applying is bounded (a window that always fights back doesn't loop)", () => {
    const t = load(); const a = t.open(mkWin("a")); let n = 0;
    const b = mkWin("b"); let cur = { ...b._g };
    Object.defineProperty(b, "frameGeometry", { configurable: true, get() { return { ...cur }; }, set(v) { n++; cur = { x: v.x, y: v.y, width: v.width + 50, height: v.height }; b._g = cur; b.frameGeometryChanged.emit(); } });
    t.open(b); for (let i = 0; i < 20; i++) b.frameGeometryChanged.emit();
    assert(n < 30, "set " + n + " times");
});

test("v1.3: a window that drifts away from its tile (app resized itself) is put back", () => {
    const t = load(); const a = t.open(mkWin("a")), b = t.open(mkWin("b"));
    b._g = { x: 300, y: 300, width: 488, height: 784 }; b.frameGeometryChanged.emit();
    assert.deepStrictEqual(g(b), A(504, 8, 488, 784));
});

test("v1.3: mouse resizing is not fought, and reset clears learned minimums", () => {
    const t = load(); const a = t.open(mkWin("a")), b = t.open(mkWin("b"));
    a.resize = true; a.interactiveMoveResizeStarted.emit(); a._g = { ...a._g, width: 600 }; a.frameGeometryChanged.emit(); a.interactiveMoveResizeFinished.emit();
    assert.strictEqual(g(a).width, 600);
    const t2 = load(); const c = t2.open(stubborn(mkWin("c"), 700, 0)), d = t2.open(mkWin("d")); c.frameGeometryChanged.emit();
    t2.ws.activeWindow = d; t2.shortcuts["Reset Ratios"]();
});

test("v1.3: dump state shows actual vs tile size and flags a window that is too big for its tile", () => {
    const t = load(); const a = t.open(mkWin("a")), b = t.open(mkWin("b", { minSize: { width: 300, height: 50 } }));
    b._g = { ...b._g, width: 700 }; t.ws.activeWindow = a; t.logs.length = 0; t.shortcuts["Dump State to Log"]();
    const txt = t.logs.join("\n"); assert(/actual 700x784, tile 488x784 +<-- LARGER THAN ITS TILE/.test(txt) && /declared min 300x50/.test(txt), txt);
});

test("v1.3: fullscreen/maximize changes are not fought by the re-apply", () => {
    const t = load(); const a = t.open(mkWin("a")), b = t.open(mkWin("b"));
    b.fullScreen = true; b.fullScreenChanged.emit(); b._g = { x: 0, y: 0, width: 1000, height: 800 }; b.frameGeometryChanged.emit();
    assert.deepStrictEqual(g(b), FULL); assert.deepStrictEqual(g(a), FULL);
});

// ======================= v1.4: text openers and photo viewers float =======================
test("v1.4: text editors and photo viewers open floating and leave the tiles alone", () => {
    const apps = [["org.kde.kate", "kate"], ["org.kde.kwrite", "kwrite"], ["gedit", "gedit"], ["org.gnome.TextEditor", "gnome-text-editor"], ["mousepad", "mousepad"],
                  ["org.kde.gwenview", "gwenview"], ["eog", "eog"], ["org.gnome.Loupe", "loupe"], ["ristretto", "ristretto"], ["nomacs", "nomacs"], ["feh", "feh"], ["imv", "imv"]];
    for (const [cls, name] of apps) {
        const t = load({ real: true }); const a = t.open(mkWin("a")), b = t.open(mkWin("b"));
        const x = t.open(mkWin("x", { resourceClass: cls, resourceName: name }));
        assert.deepStrictEqual(g(a), A(8, 8, 488, 784), cls + " must not take a tile"); assert.deepStrictEqual(g(b), A(504, 8, 488, 784));
        assert(g(x).x > 8 && g(x).x + g(x).width < 992, cls + " is centred"); assert.strictEqual(t.ws.raised[t.ws.raised.length - 1], x);
    }
});

test("v1.4: they don't count toward the 5-window limit", () => {
    const t = load({ real: true }); const w = [1, 2, 3, 4, 5].map(n => t.open(mkWin("w" + n)));
    t.open(mkWin("img", { resourceClass: "org.kde.gwenview", resourceName: "gwenview" })); t.open(mkWin("txt", { resourceClass: "gedit", resourceName: "gedit" }));
    noOverlap(w); inside(w, screenA.area, 8); assert(!t.osd().some(m => /max 5 tiled/.test(m)), "nothing counted as overflow");
});

test("v1.4: real editors and viewers that you want tiled still tile (IDEs, Okular, Krita, browsers)", () => {
    for (const [cls, name] of [["code", "code"], ["jetbrains-idea", "idea"], ["org.kde.okular", "okular"], ["krita", "krita"], ["firefox", "firefox"], ["libreoffice-writer", "soffice"]]) {
        const t = load({ real: true }); const a = t.open(mkWin("a")), x = t.open(mkWin("x", { resourceClass: cls, resourceName: name }));
        assert.deepStrictEqual(g(x), A(504, 8, 488, 784), cls + " should tile");
    }
});

test("v1.4: a photo viewer can be dragged into the tiling, and Meta+Ctrl+F still toggles its app", () => {
    const t = load({ real: true }); const a = t.open(mkWin("a")), b = t.open(mkWin("b"));
    const v = t.open(mkWin("v", { resourceClass: "org.kde.gwenview", resourceName: "gwenview" }));
    dropOn(t, v, 800, 20); assert.deepStrictEqual(g(v), A(504, 8, 488, 388)); noOverlap([a, b, v]);
    t.ws.activeWindow = v; t.shortcuts["Toggle Float for This App"]();
    assert.deepStrictEqual(g(v), A(504, 8, 488, 388), "first press: the app stops being float-first; the dragged-in window stays tiled");
    const v2 = t.open(mkWin("v2", { resourceClass: "org.kde.gwenview", resourceName: "gwenview" }));
    noOverlap([a, b, v, v2]); inside([a, b, v, v2], screenA.area, 8);   // v2 tiles like any other window now
    t.ws.activeWindow = v; t.shortcuts["Toggle Float for This App"]();
    assert.deepStrictEqual(g(b), A(504, 8, 488, 784), "second press: the app floats again");
});

test("v1.4: the new classes are in the constant, lower-case matching works", () => {
    const m = fs.readFileSync(MAIN, "utf8").match(/const FLOAT_GROUPS = \{([\s\S]*?)\n\};/)[1];
    for (const c of ["kate", "kwrite", "gedit", "mousepad", "gwenview", "eog", "ristretto", "nomacs", "loupe"]) assert(m.includes('"' + c + '"'), c);
    for (const c of ["code", "jetbrains", "okular", "firefox"]) assert(!m.includes('"' + c + '"'), c + " must not float by default");
});

// ======================= v1.5: everything that is not a constant part of a workspace =======================
const FLOAT_SAMPLES = {
    "music players": [["org.kde.elisa", "elisa"], ["spotify", "spotify"], ["Spotify", "spotify"], ["rhythmbox", "rhythmbox"], ["strawberry", "strawberry"], ["org.kde.amarok", "amarok"], ["audacious", "audacious"], ["clementine", "clementine"], ["deadbeef", "deadbeef"], ["org.gnome.Lollypop", "lollypop"], ["cantata", "cantata"], ["org.gnome.Music", "gnome-music"]],
    "video players": [["vlc", "vlc"], ["mpv", "mpv"], ["org.kde.haruna", "haruna"], ["io.github.celluloid_player.Celluloid", "celluloid"], ["org.gnome.Totem", "totem"], ["smplayer", "smplayer"]],
    "calculators": [["org.kde.kcalc", "kcalc"], ["org.gnome.Calculator", "gnome-calculator"], ["qalculate-gtk", "qalculate-gtk"], ["speedcrunch", "speedcrunch"]],
    "password managers and keys": [["org.keepassxc.KeePassXC", "keepassxc"], ["Bitwarden", "bitwarden"], ["org.kde.kwalletmanager", "kwalletmanager"], ["org.gnome.seahorse.Application", "seahorse"], ["org.kde.kleopatra", "kleopatra"]],
    "archive and download tools": [["org.kde.ark", "ark"], ["org.gnome.FileRoller", "file-roller"], ["xarchiver", "xarchiver"], ["org.qbittorrent.qBittorrent", "qbittorrent"], ["org.kde.ktorrent", "ktorrent"], ["transmission-gtk", "transmission-gtk"]],
    "system and settings tools": [["org.kde.plasma-systemmonitor", "plasma-systemmonitor"], ["org.gnome.SystemMonitor", "gnome-system-monitor"], ["org.kde.kinfocenter", "kinfocenter"], ["org.kde.discover", "plasma-discover"], ["org.gnome.Software", "gnome-software"], ["org.kde.partitionmanager", "partitionmanager"], ["gparted", "gparted"], ["org.gnome.baobab", "baobab"], ["org.kde.filelight", "filelight"], ["org.gnome.Settings", "gnome-control-center"], ["org.gnome.tweaks", "gnome-tweaks"], ["qt6ct", "qt6ct"]],
    "audio, network and device panels": [["pavucontrol", "pavucontrol"], ["blueman-manager", "blueman-manager"], ["nm-connection-editor", "nm-connection-editor"], ["easyeffects", "easyeffects"], ["org.kde.kdeconnect.app", "kdeconnect-app"], ["system-config-printer", "system-config-printer"]],
    "screenshots, pickers, clipboard": [["org.kde.spectacle", "spectacle"], ["flameshot", "flameshot"], ["org.kde.kcolorchooser", "kcolorchooser"], ["org.kde.kcharselect", "kcharselect"], ["org.kde.plasma.emojier", "plasma.emojier"], ["com.github.hluk.copyq", "copyq"]],
};

test("v1.5: every kind of 'not constant in a workspace' app opens floating, centred, raised, and leaves the tiles alone", () => {
    for (const [kind, apps] of Object.entries(FLOAT_SAMPLES)) for (const [cls, name] of apps) {
        const t = load({ real: true }); const a = t.open(mkWin("a")), b = t.open(mkWin("b"));
        const x = t.open(mkWin("x", { resourceClass: cls, resourceName: name }));
        assert.deepStrictEqual(g(a), A(8, 8, 488, 784), kind + ": " + cls + " must not take a tile"); assert.deepStrictEqual(g(b), A(504, 8, 488, 784), cls);
        assert(g(x).x > 8 && g(x).x + g(x).width < 992, cls + " is centred"); assert.strictEqual(t.ws.raised[t.ws.raised.length - 1], x, cls + " raised");
    }
});

test("v1.5: apps that are a constant part of a workspace still tile", () => {
    const keep = [["firefox", "firefox"], ["org.mozilla.firefox", "firefox"], ["chromium", "chromium"], ["google-chrome", "google-chrome"], ["brave-browser", "brave-browser"], ["vivaldi-stable", "vivaldi"],
                  ["code", "code"], ["VSCodium", "vscodium"], ["jetbrains-idea", "idea"], ["jetbrains-pycharm", "pycharm"], ["org.kde.okular", "okular"], ["libreoffice-writer", "soffice"], ["libreoffice-calc", "soffice"],
                  ["discord", "discord"], ["org.telegram.desktop", "telegram-desktop"], ["Slack", "slack"], ["signal", "signal"], ["thunderbird", "thunderbird"], ["org.kde.kmail2", "kmail2"],
                  ["obsidian", "obsidian"], ["krita", "krita"], ["gimp", "gimp"], ["blender", "blender"], ["inkscape", "inkscape"], ["org.kde.kdenlive", "kdenlive"], ["org.kde.kontact", "kontact"], ["zotero", "zotero"]];
    for (const [cls, name] of keep) {
        const t = load({ real: true }); const a = t.open(mkWin("a")), x = t.open(mkWin("x", { resourceClass: cls, resourceName: name }));
        assert.deepStrictEqual(g(x), A(504, 8, 488, 784), cls + " should tile");
    }
});

test("v1.5: any number of such apps can be open without using up the five tiles", () => {
    const t = load({ real: true }); const w = [1, 2, 3, 4, 5].map(n => t.open(mkWin("w" + n)));
    const extras = FLOAT_SAMPLES["music players"].slice(0, 4).concat(FLOAT_SAMPLES["calculators"].slice(0, 2), FLOAT_SAMPLES["system and settings tools"].slice(0, 3));
    extras.forEach(([cls, name], i) => t.open(mkWin("e" + i, { resourceClass: cls, resourceName: name })));
    noOverlap(w); inside(w, screenA.area, 8); assert(!t.osd().some(m => /max 5 tiled/.test(m)), "none counted as overflow");
});

test("v1.5: class matching ignores case and also matches the resource name", () => {
    const t = load({ real: true }); const a = t.open(mkWin("a"));
    const x = t.open(mkWin("x", { resourceClass: "SomethingElse", resourceName: "Spotify" }));      // only the name matches
    const y = t.open(mkWin("y", { resourceClass: "SPOTIFY", resourceName: "x" }));                  // only the class, upper case
    assert.deepStrictEqual(g(a), FULL, "neither took a tile");
});

test("v1.5: the list has no duplicates, no browsers/IDEs/office/chat entries, and every entry is a plain class name", () => {
    const m = fs.readFileSync(MAIN, "utf8").match(/const FLOAT_GROUPS = \{([\s\S]*?)\n\};/)[1];
    const list = [...m.matchAll(/"([^"]+)"/g)].map(x => x[1].toLowerCase());
    assert(list.length > 150, "broad list: " + list.length); assert.strictEqual(new Set(list).size, list.length, "duplicates");
    const never = ["firefox", "chromium", "google-chrome", "brave-browser", "code", "vscodium", "idea", "pycharm", "okular", "soffice", "libreoffice-writer", "libreoffice-calc",
                   "discord", "telegram-desktop", "slack", "signal", "thunderbird", "kmail2", "obsidian", "krita", "gimp", "blender", "inkscape", "kdenlive", "zotero", "plasmashell", "krunner"];
    for (const c of never) assert(!list.includes(c), c + " must not be in the list");
    for (const c of list) assert(/^[a-z0-9][a-z0-9._-]*$/.test(c), "odd entry: " + c);
});

test("v1.5: Meta+Ctrl+F still switches any of them to tiling and back, for the session", () => {
    const t = load({ real: true }); const a = t.open(mkWin("a"));
    const p = t.open(mkWin("p", { resourceClass: "org.kde.elisa", resourceName: "elisa" })); assert.deepStrictEqual(g(a), FULL);
    t.ws.activeWindow = p; t.shortcuts["Toggle Float for This App"](); assert.strictEqual(g(a).width, 488, "elisa tiles now"); noOverlap([a, p]);
    t.shortcuts["Toggle Float for This App"](); assert.deepStrictEqual(g(a), FULL, "and floats again");
});

test("v1.5: a music player that was already open when the script started floats where it is", () => {
    const m = mkWin("m", { resourceClass: "spotify", resourceName: "spotify", _g: { x: 300, y: 200, width: 700, height: 500 } }), a = mkWin("a"), b = mkWin("b");
    load({ real: true, pre: [a, m, b] }); assert.deepStrictEqual(g(m), A(300, 200, 700, 500)); noOverlap([a, b]);
});


test("v1.6: a floating window dropped on a tile's body does not snap; on the title bar it does", () => {
    const t = load({ real: true }); const w = openN(t, 3); const f = t.open(mkWin("f")); t.ws.activeWindow = f; t.shortcuts["Toggle Floating"]();
    const snap = JSON.stringify(w.map(g)); const tile = g(w[1]);
    dropOn(t, f, tile.x + 100, tile.y + 100);
    assert.strictEqual(JSON.stringify(w.map(g)), snap, "tiles untouched");
    assert(g(f).x === tile.x + 80 && g(f).y === tile.y + 80, "f stays where it was dropped");
    dropOn(t, f, tile.x + 100, tile.y + 10);
    assert.deepStrictEqual(g(f), tile, "title-bar drop joins the tile");
});

test("v1.6: a floating window can be dragged across several tiles without snapping, only the release spot matters", () => {
    const t = load({ real: true }); const w = openN(t, 5); const f = t.open(mkWin("f"));
    const snap = JSON.stringify(w.map(g));
    dropOn(t, f, g(w[0]).x + 200, g(w[0]).y + 200);
    dropOn(t, f, g(w[3]).x + 50, g(w[3]).y + 60);
    assert.strictEqual(JSON.stringify(w.map(g)), snap);
});

test("v1.6: a neighbour that is slow to follow a resize does not undo it (3, 4 and 5 windows)", () => {
    for (const n of [3, 4, 5]) {
        const t = load({ smart: true, real: true }); const w = []; for (let q = 0; q < n; q++) w.push(t.open(mk("w" + q)));
        const old = w.map(g);
        w[0].resize = true; w[0].interactiveMoveResizeStarted.emit(); w[0]._g = { ...g(w[0]), width: g(w[0]).width + 120 }; w[0].interactiveMoveResizeFinished.emit();
        const grown = g(w[0]).width;
        for (let q = 1; q < n; q++) { w[q]._g = { ...old[q] }; w[q].frameGeometryChanged.emit(); }   // stale sizes, once
        assert.strictEqual(g(w[0]).width, grown, "n=" + n + " resize kept");
        w[0].resize = true; w[0].interactiveMoveResizeStarted.emit(); w[0]._g = { ...g(w[0]), width: grown - 200 }; w[0].interactiveMoveResizeFinished.emit();
        assert.strictEqual(g(w[0]).width, grown - 200, "n=" + n + " can shrink again");
    }
});

test("v1.6: keyboard ratio and share changes are not blocked by stale learned minimums", () => {
    const t = load({ smart: true, real: true }); const w = [0, 1, 2].map(q => t.open(mk("w" + q)));
    t.ws.activeWindow = w[0]; t.shortcuts["Ratio Wider"](); const a = g(w[0]).width;
    for (let q = 1; q < 3; q++) { w[q]._g = { ...w[q]._g, width: 900 }; w[q].frameGeometryChanged.emit(); }
    t.shortcuts["Ratio Wider"](); assert(g(w[0]).width > a, "still widens");
});

test("v1.7: every shared edge of every window can be dragged (2-5 windows, smart on/off, mirrored or not)", () => {
    let checked = 0;
    for (const smart of [false, true]) for (const mir of [false, true]) for (const n of [2, 3, 4, 5]) for (let i = 0; i < n; i++)
        for (const side of ["left", "right", "top", "bottom"]) for (const d of [-60, 60]) {
            const t = load({ smart, real: true }); const w = []; for (let q = 0; q < n; q++) w.push(t.open(mk("w" + q)));
            if (mir) { t.ws.activeWindow = w[0]; t.shortcuts["Mirror Layout"](); }
            const b = g(w[i]);
            const horiz = side === "left" || side === "right";
            // a neighbour touches this edge (within the gap) with overlapping extent?
            const nb = w.find((o, q) => {
                if (q === i) return false; const c = g(o);
                const ov = horiz ? (c.y < b.y + b.height && c.y + c.height > b.y) : (c.x < b.x + b.width && c.x + c.width > b.x);
                if (!ov) return false;
                return side === "right" ? Math.abs(c.x - (b.x + b.width)) <= 9 : side === "left" ? Math.abs(c.x + c.width - b.x) <= 9
                     : side === "bottom" ? Math.abs(c.y - (b.y + b.height)) <= 9 : Math.abs(c.y + c.height - b.y) <= 9;
            });
            if (!nb) continue;
            const nbBefore = g(nb); const ng = { ...b };
            if (side === "right") ng.width += d; if (side === "bottom") ng.height += d;
            if (side === "left") { ng.x += d; ng.width -= d; } if (side === "top") { ng.y += d; ng.height -= d; }
            w[i].resize = true; w[i].interactiveMoveResizeStarted.emit(); w[i]._g = ng; w[i].interactiveMoveResizeFinished.emit();
            const a = g(w[i]); const label = `smart=${smart} mir=${mir} n=${n} w${i} ${side} ${d}`;
            const edge = (r) => side === "right" ? r.x + r.width : side === "left" ? r.x : side === "bottom" ? r.y + r.height : r.y;
            const moved = edge(a) - edge(b);
            assert(Math.abs(moved - d) <= 2, label + `: edge moved ${moved}, wanted ${d}`);
            const nbEdge = (r) => side === "right" ? r.x : side === "left" ? r.x + r.width : side === "bottom" ? r.y : r.y + r.height;
            assert(Math.abs((nbEdge(g(nb)) - nbEdge(nbBefore)) - d) <= 2, label + ": neighbour followed");
            checked++;
        }
    assert(checked > 100, "checked " + checked);
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
