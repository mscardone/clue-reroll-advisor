/* Loads the browser-side app sources into node so they can be tested headlessly. */
var path = require("path"), fs = require("fs"), vm = require("vm");
var root = path.join(__dirname, "..");
global.window = global;
global.A1lib = require(path.join(root, "vendor/a1lib.js"));
global.OCR = require(path.join(root, "vendor/ocr.js"));
global.OCR_aa_9px_mono_allcaps = require(path.join(root, "vendor/font_aa_9px_mono_allcaps.js"));
vm.runInThisContext(fs.readFileSync(path.join(root, "src/anchor.js"), "utf8"), { filename: "anchor.js" });
vm.runInThisContext(fs.readFileSync(path.join(root, "src/reader.js"), "utf8"), { filename: "reader.js" });
module.exports = {
  root: root,
  A1lib: global.A1lib, OCR: global.OCR,
  FONT: global.OCR_aa_9px_mono_allcaps,
  Reader: global.Reader,
  Advice: require(path.join(root, "src/advice.js")),
  model: JSON.parse(fs.readFileSync(path.join(root, "data/model.json"), "utf8"))
};
