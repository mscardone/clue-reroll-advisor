/* Pure decision logic. No DOM, no Alt1 - so it can be unit tested in node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Advice = factory();
})(this, function () {

  /* quantiles is a 201-point grid: index i = the (i/2)th percentile. */
  function percentileOf(quantiles, v) {
    if (v <= quantiles[0]) return 0;
    var last = quantiles.length - 1;
    if (v >= quantiles[last]) return 100;
    for (var i = 0; i < last; i++) {
      if (v < quantiles[i + 1]) {
        var span = quantiles[i + 1] - quantiles[i];
        var frac = span > 0 ? (v - quantiles[i]) / span : 0;
        return (i + frac) / last * 100;
      }
    }
    return 100;
  }

  function fmt(n) {
    n = Math.round(n);
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 2) + "M";
    if (n >= 1e4) return Math.round(n / 1e3) + "k";
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  /* opts: {tierData, value, tokens (null = unknown), cap} */
  function advise(opts) {
    var t = opts.tierData;
    var v = opts.value;
    var tokens = (typeof opts.tokens === "number") ? opts.tokens : null;
    var cap = opts.cap || 3;

    var pct = percentileOf(t.quantiles, v);
    var breakEven = t.simMean;   // a reroll is +EV below this
    var budget = t.p33;          // sustainable: you earn ~1 token per 3 clues
    var atCap = tokens !== null && tokens >= cap;

    var verdict, headline, detail;
    if (tokens === 0) {
      verdict = "none";
      headline = "No tokens";
      detail = "Nothing to decide - you have no re-roll available.";
    } else if (v < budget) {
      verdict = "reroll";
      headline = "Re-roll";
      detail = "This is in the bottom third of " + opts.tier + " caskets. You earn a token every 3 clues, "
        + "so spending one on a casket this bad is what tokens are for.";
    } else if (v < breakEven) {
      verdict = atCap ? "reroll" : "bank";
      headline = atCap ? "Re-roll (you're at cap)" : "Keep - bank the token";
      detail = atCap
        ? "Below the " + fmt(breakEven) + " break-even, and you're at the token cap, so the next token you earn "
          + "would be wasted. Spending this one is free upside."
        : "A re-roll is worth slightly more on average (" + fmt(breakEven) + "), but this casket isn't bad enough "
          + "to burn a scarce token on. Save it for one under " + fmt(budget) + ".";
    } else {
      verdict = "keep";
      headline = "Keep";
      detail = "Above the " + fmt(breakEven) + " average for a " + opts.tier + " casket. Re-rolling this would "
        + "lose value in expectation, and you can't get it back.";
    }

    var better = 100 - pct;
    return {
      verdict: verdict,
      headline: headline,
      detail: detail,
      percentile: pct,
      chanceRerollBeatsIt: better,
      breakEven: breakEven,
      budget: budget,
      median: t.simMedian,
      wikiAvg: t.wikiAvgCasket,
      atCap: atCap
    };
  }

  return { advise: advise, percentileOf: percentileOf, fmt: fmt };
});
