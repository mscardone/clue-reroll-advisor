/* Regenerate src/anchor.js from a screenshot.
 *
 * Only needed if the app can't find the casket window - e.g. you run the game
 * at a different interface scale, so the text is drawn at different pixel sizes
 * than the template was cut from.
 *
 *   node tools/calibrate.js shot.png          inspect only
 *   node tools/calibrate.js shot.png --write  rewrite src/anchor.js
 *
 * shot.png must be a lossless (PNG) capture at the game's real resolution -
 * a resized or JPEG screenshot will not match pixel for pixel.
 */
var fs = require("fs"), path = require("path"), PNG = require("pngjs").PNG;
var app = require("./loadapp.js");
var OCR = app.OCR, A1lib = app.A1lib, FONT = app.FONT;
var loadPng = require("./pngload.js");

var file = process.argv[2], write = process.argv.indexOf("--write") > 0;
if (!file) { console.error("usage: node tools/calibrate.js <screenshot.png> [--write]"); process.exit(2); }

var img = loadPng(file);
var W = img.width, H = img.height, D = img.data;
var CORE = 600;        // r+g+b for a "solid white text" pixel
var LIGHT = 420;       // r+g+b for an antialiased edge pixel

function lum(x, y) { var i = (y * W + x) * 4; return D[i] + D[i + 1] + D[i + 2]; }

/* rows that look like a line of white text */
var candidates = [];
for (var y = 0; y < H; y++) {
  var n = 0;
  for (var x = 0; x < W; x++) if (lum(x, y) >= CORE) n++;
  if (n >= 30) candidates.push({ y: y, n: n });
}
console.log("rows with white text: " + candidates.length);

var found = null;
for (var ci = 0; ci < candidates.length && !found; ci++) {
  var row = candidates[ci].y;
  var firstX = 0;
  for (var x = 0; x < W; x++) if (lum(x, row) >= CORE) { firstX = x; break; }
  for (var dy = -2; dy <= 12 && !found; dy++) {
    var base = row + dy;
    if (base - FONT.basey < 0 || base + FONT.height >= H) continue;
    var c = OCR.findChar(img, FONT, [255, 255, 255], Math.max(0, firstX - 3), base, 12, 1);
    if (!c) continue;
    var line = OCR.readLine(img, FONT, [[255, 255, 255]], c.x, c.y, true, true);
    if (line && /CURRENT\s+REWARD\s+VALUE/i.test(line.text)) {
      found = { line: line, char: c };
    }
  }
}
if (!found) {
  console.error("could not find a 'CURRENT REWARD VALUE' line in that image.");
  console.error("check it is a lossless capture of the Trail Complete! window at native size.");
  process.exit(1);
}
console.log("line: " + JSON.stringify(found.line.text));
var baseline = found.char.y;

/* vertical extent of the line */
var y0 = H, y1 = 0;
var lx0 = found.line.debugArea.x, lx1 = lx0 + found.line.debugArea.w;
for (var y = Math.max(0, baseline - FONT.basey - 2); y < Math.min(H, baseline + 6); y++) {
  for (var x = lx0; x < lx1; x++) {
    if (lum(x, y) >= LIGHT) { if (y < y0) y0 = y; if (y > y1) y1 = y; break; }
  }
}
y0 = Math.max(0, y0 - 1); y1 = Math.min(H - 1, y1 + 1);

/* word groups: a gap of >=5 empty columns separates words */
var cols = [];
for (var x = lx0; x < lx1; x++) {
  var on = false;
  for (var y = y0; y <= y1; y++) if (lum(x, y) >= LIGHT) { on = true; break; }
  cols.push(on);
}
var groups = [], run = null;
for (var i = 0; i < cols.length; i++) {
  if (cols[i]) { if (!run) run = { s: i, e: i }; else run.e = i; }
  else if (run && cols.slice(i, i + 5).every(function (c) { return !c; })) { groups.push(run); run = null; }
}
if (run) groups.push(run);
if (groups.length < 2) { console.error("couldn't split the line into words"); process.exit(1); }

var tx0 = lx0 + groups[0].s, tx1 = lx0 + groups[1].e + 1;   // "CURRENT REWARD"
var tw = tx1 - tx0, th = y1 - y0 + 1;
console.log("template box: x=" + tx0 + " y=" + y0 + " w=" + tw + " h=" + th);

var png = new PNG({ width: tw, height: th });
var opaque = 0;
for (var y = 0; y < th; y++) for (var x = 0; x < tw; x++) {
  var si = ((y0 + y) * W + (tx0 + x)) * 4, di = (y * tw + x) * 4;
  if (D[si] + D[si + 1] + D[si + 2] >= CORE) {
    png.data[di] = D[si]; png.data[di + 1] = D[si + 1]; png.data[di + 2] = D[si + 2]; png.data[di + 3] = 255;
    opaque++;
  }
}
var b64 = PNG.sync.write(png).toString("base64");
var dx = found.char.x - tx0, dy = baseline - y0;
console.log("opaque pixels: " + opaque + "   ANCHOR_DX=" + dx + " ANCHOR_DY=" + dy);
if (opaque < 80) console.log("WARNING: very few solid pixels - matching may be unreliable");

/* prove the new template finds itself, and only once */
var needle = loadPng.fromDataUrl("data:image/png;base64," + b64);
var hits = A1lib.ImageDetect.findSubbuffer(img, needle);
console.log("self-test: " + hits.length + " hit(s) " + JSON.stringify(hits.slice(0, 3)));
if (!hits.length || hits[0].x !== tx0 || hits[0].y !== y0) {
  console.error("self-test failed - not writing anchor.js"); process.exit(1);
}
var reread = app.Reader._lineAt(img, [255, 255, 255], hits[0].x + dx - 3, hits[0].y + dy - 2, 8, 5);
console.log("re-read through the template: " + JSON.stringify(reread && reread.text));
console.log("parsed value: " + app.Reader.parseValue(reread ? reread.text : ""));

if (write) {
  var out = fs.readFileSync(path.join(__dirname, "../src/anchor.js"), "utf8")
    .replace(/window\.ANCHOR_DX = \d+;/, "window.ANCHOR_DX = " + dx + ";")
    .replace(/window\.ANCHOR_DY = \d+;/, "window.ANCHOR_DY = " + dy + ";")
    .replace(/window\.ANCHOR_PNG = "[^"]*";/, 'window.ANCHOR_PNG = "data:image/png;base64,' + b64 + '";');
  fs.writeFileSync(path.join(__dirname, "../src/anchor.js"), out);
  console.log("wrote src/anchor.js");
} else {
  console.log("(dry run - pass --write to update src/anchor.js)");
}
