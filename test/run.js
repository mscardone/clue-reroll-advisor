/* Headless checks: decision logic, model sanity, and - if you point it at a
   screenshot - the whole screen-reading pipeline.
     npm test                      logic + model only
     npm test path/to/shot.png     also reads the casket window out of the image  */
var app = require("../tools/loadapp.js");
var Advice = app.Advice, model = app.model, OCR = app.OCR, A1lib = app.A1lib, FONT = app.FONT;
var fails = 0, checks = 0;

function ok(name, cond, extra) {
  checks++;
  if (cond) { console.log("  ok   " + name); }
  else { fails++; console.log("  FAIL " + name + (extra !== undefined ? "  -> " + extra : "")); }
}

console.log("model");
var tiers = ["easy", "medium", "hard", "elite", "master"];
tiers.forEach(function (t) {
  var d = model.tiers[t];
  ok(t + ": present", !!d);
  ok(t + ": 201 quantiles", d.quantiles.length === 201, d.quantiles.length);
  var sorted = d.quantiles.every(function (v, i, a) { return i === 0 || v >= a[i - 1]; });
  ok(t + ": quantiles ascending", sorted);
  ok(t + ": p33 < median < mean", d.p33 <= d.simMedian && d.simMedian <= d.simMean,
     d.p33 + "/" + d.simMedian + "/" + d.simMean);
  ok(t + ": mean within 2x of the wiki average", d.simMean > d.wikiAvgCasket / 3 && d.simMean < d.wikiAvgCasket * 3,
     d.simMean + " vs " + d.wikiAvgCasket);
});

console.log("percentiles");
var q = model.tiers.medium.quantiles;
ok("floor", Advice.percentileOf(q, -1) === 0);
ok("ceiling", Advice.percentileOf(q, 1e12) === 100);
ok("monotonic", (function () {
  var prev = -1;
  for (var v = 0; v < 3e6; v += 25000) {
    var p = Advice.percentileOf(q, v);
    if (p < prev) return false;
    prev = p;
  }
  return true;
})());
ok("median sits near 50", Math.abs(Advice.percentileOf(q, model.tiers.medium.simMedian) - 50) < 2,
   Advice.percentileOf(q, model.tiers.medium.simMedian).toFixed(1));

console.log("advice");
var med = model.tiers.medium;
function v(value, tokens, cap) {
  return Advice.advise({ tierData: med, tier: "medium", value: value, tokens: tokens, cap: cap || 3 });
}
ok("junk casket -> reroll", v(5000, 1).verdict === "reroll");
ok("just under p33 -> reroll", v(med.p33 - 1, 1).verdict === "reroll");
ok("just over p33 -> bank", v(med.p33 + 1, 1).verdict === "bank");
ok("just under break-even -> bank", v(med.simMean - 1, 1).verdict === "bank");
ok("at break-even -> keep", v(med.simMean, 1).verdict === "keep");
ok("big casket -> keep", v(3000000, 1).verdict === "keep");
ok("at token cap, mid casket -> reroll", v(med.simMean - 1, 3, 3).verdict === "reroll");
ok("at cap never overrides a good casket", v(med.simMean + 1, 3, 3).verdict === "keep");
ok("no tokens -> none", v(50, 0).verdict === "none");
ok("unknown tokens still advises", v(5000, null).verdict === "reroll");
ok("the casket that started this: 678,818 -> keep", v(678818, 1).verdict === "keep",
   "p" + v(678818, 1).percentile.toFixed(1));

console.log("value parsing");
[["CURRENT REWARD VALUE: 678,818 COINS!", 678818],
 ["CURRENT REWARD VALUE: 1.234.567 COINS!", 1234567],
 ["CURRENT REWARD VALUE: 41 COINS!", 41],
 ["REROLL PROGRESS - 0/3", null],
 ["", null]].forEach(function (c) {
  ok("parse " + JSON.stringify(c[0]).slice(0, 42), app.Reader.parseValue(c[0]) === c[1],
     app.Reader.parseValue(c[0]));
});

var shot = process.argv[2] || (function () {
  var fs = require("fs"), path = require("path");
  var dir = path.join(__dirname);
  var png = fs.readdirSync(dir).filter(function (f) { return /\.png$/i.test(f); })[0];
  return png ? path.join(dir, png) : null;
})();

if (shot) {
  console.log("screen reading  (" + shot + ")");
  var loadPng = require("../tools/pngload.js");
  var img = loadPng(shot);
  var anchor = loadPng.fromDataUrl(global.ANCHOR_PNG);
  var hits = A1lib.ImageDetect.findSubbuffer(img, anchor);
  ok("found the 'CURRENT REWARD VALUE' template", hits.length > 0, hits.length + " hits");
  if (hits.length) {
    var h = hits[0];
    var line = app.Reader._lineAt(img, [255, 255, 255],
      h.x + global.ANCHOR_DX - 3, h.y + global.ANCHOR_DY - 2, 8, 5);
    ok("read the value line", !!line, line && line.text);
    if (line) {
      var value = app.Reader.parseValue(line.text);
      ok("parsed a value out of it", typeof value === "number", value);
      console.log("       text: " + JSON.stringify(line.text));
      var centre = Math.round(line.debugArea.x + line.debugArea.w / 2);
      var p = app.Reader._lineAt(img, [255, 255, 255], centre - 140, line.baseline + 27 - 2, 160, 5);
      var b = app.Reader._lineAt(img, [0, 0, 0], centre - 150, line.baseline + 77 - 3, 170, 7);
      console.log("       progress line: " + (p ? JSON.stringify(p.text) : "(not in frame)"));
      console.log("       button line:   " + (b ? JSON.stringify(b.text) : "(not in frame)"));
      if (typeof value === "number") {
        var a = Advice.advise({ tierData: med, tier: "medium", value: value, tokens: 1, cap: 3 });
        console.log("       verdict (as a medium): " + a.headline + "  p" + a.percentile.toFixed(0));
      }
    }
  }
} else {
  console.log("screen reading  (skipped - drop a screenshot in test/ or pass one as an argument)");
}

console.log("");
console.log(fails ? fails + " of " + checks + " checks FAILED" : "all " + checks + " checks passed");
process.exit(fails ? 1 : 0);
