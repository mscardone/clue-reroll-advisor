(function () {
  "use strict";
  var model = null, tier = "medium", state = { value: null, tokens: null, progress: null, progressOf: null };
  var lastKey = "", timer = null;

  var $ = function (id) { return document.getElementById(id); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem("cra." + k); return v === null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem("cra." + k, v); } catch (e) { } }
  };

  function status(msg, warn) {
    var el = $("status");
    el.textContent = msg;
    el.className = warn ? "warn" : "";
  }

  function gp(n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function render() {
    var t = model && model.tiers[tier];
    if (!t) return;
    $("s-budget").textContent = gp(t.p33) + " gp";
    $("s-even").textContent = gp(t.simMean) + " gp";
    $("s-median").textContent = gp(t.simMedian) + " gp";
    $("s-tokens").textContent = state.tokens === null ? "?"
      : state.tokens + (state.progress !== null ? "  (" + state.progress + "/" + state.progressOf + ")" : "");

    var evenPct = Advice.percentileOf(t.quantiles, t.simMean);
    $("tick-budget").style.left = "33%";
    $("tick-even").style.left = evenPct.toFixed(1) + "%";

    var box = $("verdict");
    if (state.value === null) {
      box.className = "verdict idle";
      $("v-head").textContent = "Waiting for a casket";
      $("v-value").innerHTML = "&mdash;";
      $("v-detail").textContent = "Open a reward casket with Alt1 running, or type a value in below.";
      $("bar-fill").style.width = "0"; $("bar-marker").style.left = "0";
      $("lg-pct").textContent = ""; $("lg-beat").textContent = "";
      return;
    }

    var a = Advice.advise({
      tierData: t, tier: tier, value: state.value,
      tokens: state.tokens, cap: +$("m-cap").value
    });
    box.className = "verdict " + a.verdict;
    $("v-head").textContent = a.headline;
    $("v-value").textContent = gp(state.value) + " gp";
    $("v-detail").textContent = a.detail;
    $("bar-fill").style.width = a.percentile.toFixed(1) + "%";
    $("bar-marker").style.left = a.percentile.toFixed(1) + "%";
    $("lg-pct").textContent = "better than " + a.percentile.toFixed(0) + "% of " + tier + " caskets";
    $("lg-beat").textContent = "a re-roll beats it " + a.chanceRerollBeatsIt.toFixed(0) + "% of the time";

    if ($("o-overlay").checked && window.alt1 && alt1.permissionOverlay) {
      var col = a.verdict === "keep" ? A1lib.mixColor(90, 200, 110)
        : a.verdict === "reroll" ? A1lib.mixColor(235, 110, 70) : A1lib.mixColor(220, 180, 60);
      alt1.overLaySetGroup("craVerdict");
      alt1.overLayClearGroup("craVerdict");
      alt1.overLayText(a.headline.toUpperCase() + " - " + gp(state.value), col, 14,
        alt1.rsX + Math.round(alt1.rsWidth / 2) - 90, alt1.rsY + 60, 4000);
    }
  }

  function applyRead(r) {
    if (r.error) {
      if (r.error === "no-window") { status("no casket window on screen"); }
      else { status(r.error, true); }
      return false;
    }
    var key = r.value + "/" + r.tokens + "/" + r.progress;
    state.value = r.value;
    if (typeof r.tokens === "number") { state.tokens = r.tokens; $("m-tokens").value = r.tokens; }
    if (typeof r.progress === "number") { state.progress = r.progress; state.progressOf = r.progressOf; }
    $("m-value").value = gp(r.value);
    if (key !== lastKey) { lastKey = key; status("read at " + new Date().toLocaleTimeString()); }
    render();
    return true;
  }

  function scan(manual) {
    if (!model) return;
    var r;
    try { r = Reader.read(); }
    catch (e) { status("read failed: " + e.message, true); return; }
    if (!applyRead(r) && manual && r.error === "no-window") {
      status("couldn't find the Trail Complete! window - is it open at 100% UI scale?", true);
    }
  }

  function loop() {
    if ($("o-auto").checked && window.alt1) scan(false);
    timer = setTimeout(loop, 900);
  }

  function selectTier(t) {
    tier = t; store.set("tier", t);
    Array.prototype.forEach.call(document.querySelectorAll("#tiers button"), function (b) {
      b.classList.toggle("on", b.dataset.tier === t);
    });
    render();
  }

  /* ---- wiring ---- */
  Array.prototype.forEach.call(document.querySelectorAll("#tiers button"), function (b) {
    b.addEventListener("click", function () { selectTier(b.dataset.tier); });
  });
  $("scan").addEventListener("click", function () { scan(true); });
  $("m-value").addEventListener("input", function () {
    var n = parseInt(this.value.replace(/[^0-9]/g, ""), 10);
    state.value = isFinite(n) ? n : null;
    render();
  });
  $("m-tokens").addEventListener("input", function () {
    var n = parseInt(this.value, 10);
    state.tokens = isFinite(n) ? n : null;
    render();
  });
  $("m-cap").addEventListener("change", function () { store.set("cap", this.value); render(); });
  $("o-auto").addEventListener("change", function () { store.set("auto", this.checked ? "1" : "0"); });
  $("o-overlay").addEventListener("change", function () { store.set("overlay", this.checked ? "1" : "0"); });

  $("m-cap").value = store.get("cap", "3");
  $("o-auto").checked = store.get("auto", "1") === "1";
  $("o-overlay").checked = store.get("overlay", "0") === "1";

  fetch("./data/model.json").then(function (r) { return r.json(); }).then(function (m) {
    model = m;
    $("model-note").textContent = "Model: " + m.nSim.toLocaleString() + " simulated caskets from the "
      + "wiki reward tables, built " + m.generated + ". Item prices drift, so treat the thresholds as "
      + "guide rails rather than gospel.";
    selectTier(store.get("tier", "medium"));
    if (window.alt1) {
      alt1.identifyAppUrl("./appconfig.json");
      Reader.init().then(function () {
        status(alt1.permissionPixel ? "watching for caskets" : "grant this app screen-capture permission in Alt1", !alt1.permissionPixel);
        loop();
      });
    } else {
      status("not running in Alt1 - manual entry only");
    }
  }).catch(function (e) {
    status("couldn't load data/model.json (" + e.message + ") - serve this folder over http, don't open the file directly", true);
  });
})();
