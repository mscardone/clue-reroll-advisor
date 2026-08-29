/* Screen reading: find the Trail Complete! window and OCR the numbers off it. */
window.Reader = (function () {
  var FONT = window.OCR_aa_9px_mono_allcaps;
  var WHITE = [255, 255, 255];
  var BLACK = [0, 0, 0];          // the reroll button's text outline
  var PROGRESS_DY = 27;           // baseline offsets from the value line
  var BUTTON_DY = 77;
  var anchor = null;

  function init() {
    return A1lib.ImageDetect.imageDataFromUrl(window.ANCHOR_PNG).then(function (d) {
      anchor = d; return true;
    });
  }

  function parseValue(text) {
    var m = /VALUE:?\s*([0-9][0-9.,\s]*)\s*COIN/i.exec(text);
    if (!m) m = /([0-9][0-9.,]{2,})\s*COIN/i.exec(text);
    if (!m) return null;
    var n = parseInt(m[1].replace(/[^0-9]/g, ""), 10);
    return isFinite(n) ? n : null;
  }

  function lineAt(buf, colour, x, y, w, h) {
    /* findChar walks raw buffer indexes - fractional coords silently read garbage. */
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    if (x < 0) { w += x; x = 0; }
    if (y < 0) { h += y; y = 0; }
    if (w <= 0 || h <= 0) return null;
    var c = OCR.findChar(buf, FONT, colour, x, y, w, h);
    if (!c) return null;
    var r = OCR.readLine(buf, FONT, [colour], c.x, c.y, true, true);
    if (!r || !r.text) return null;
    r.baseline = c.y;
    return r;
  }

  /* Returns {value, tokens, progress, progressOf, raw} or {error}. */
  function read() {
    if (!window.alt1) return { error: "Alt1 is not running this page." };
    if (!alt1.permissionPixel) return { error: "Alt1 needs screen-capture permission for this app." };
    if (!anchor) return { error: "Still loading the template." };
    if (!alt1.rsLinked) return { error: "Alt1 can't see the RuneScape window." };

    var img = A1lib.captureHoldFullRs();
    var hits = A1lib.ImageDetect.findSubimage(img, anchor);
    if (!hits.length) return { error: "no-window" };
    var h = hits[0];

    var rx = Math.max(0, h.x - 320), ry = Math.max(0, h.y - 30);
    var rw = Math.min(img.width - rx, 960), rh = Math.min(img.height - ry, 170);
    var buf = img.read(rx, ry, rw, rh);
    var ax = h.x - rx, ay = h.y - ry;

    var vline = lineAt(buf, WHITE, ax + window.ANCHOR_DX - 3, ay + window.ANCHOR_DY - 2, 8, 5);
    if (!vline) return { error: "found the window but couldn't read the value line." };
    var value = parseValue(vline.text);
    if (value === null) return { error: "unreadable value: \"" + vline.text + "\"" };

    var out = { value: value, raw: vline.text };
    var centre = Math.round(vline.debugArea.x + vline.debugArea.w / 2);

    var pline = lineAt(buf, WHITE, centre - 140, vline.baseline + PROGRESS_DY - 2, 160, 5);
    if (pline) {
      var pm = /(\d+)\s*\/\s*(\d+)/.exec(pline.text);
      if (pm) { out.progress = +pm[1]; out.progressOf = +pm[2]; }
    }
    var bline = lineAt(buf, BLACK, centre - 150, vline.baseline + BUTTON_DY - 3, 170, 7);
    if (bline) {
      var bm = /\((\d+)\)/.exec(bline.text);
      if (bm) out.tokens = +bm[1];
      else if (/REROLL/i.test(bline.text)) out.tokens = 0;
    }
    return out;
  }

  return { init: init, read: read, parseValue: parseValue, _lineAt: lineAt, FONT: FONT };
})();
