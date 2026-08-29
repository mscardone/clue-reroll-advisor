/* Tiny static server so Alt1 can load the app over http.
   Usage: npm run serve  [port]                                            */
var http = require("http"), fs = require("fs"), path = require("path"), os = require("os");
var root = path.join(__dirname, ".."), port = +(process.argv[2] || 8231);
var MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon", ".csv": "text/csv" };

http.createServer(function (req, res) {
  var rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  var file = path.join(root, path.normalize(rel).replace(/^(\.\.[\/\\])+/, ""));
  fs.readFile(file, function (err, buf) {
    if (err) { res.writeHead(404); return res.end("not found: " + rel); }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache"
    });
    res.end(buf);
  });
}).listen(port, function () {
  var ips = ["localhost"];
  var n = os.networkInterfaces();
  Object.keys(n).forEach(function (k) {
    n[k].forEach(function (a) { if (a.family === "IPv4" && !a.internal) ips.push(a.address); });
  });
  console.log("Clue Re-roll Advisor served from " + root);
  console.log("");
  console.log("  Add to Alt1 by pasting this in Alt1's browser address bar:");
  console.log("  alt1://addapp/http://" + ips[0] + ":" + port + "/appconfig.json");
  console.log("");
  console.log("  (plain http://" + ips[0] + ":" + port + "/ opens it in a normal browser too)");
  console.log("  ctrl-c to stop");
});
