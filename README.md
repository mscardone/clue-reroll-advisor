# Clue Re-roll Advisor

An [Alt1 Toolkit](https://runeapps.org/alt1) app for RuneScape 3. It watches for the
**Trail Complete!** window, reads the casket's value, how many re-roll tokens you have and
your re-roll progress straight off the screen, and tells you whether the casket is worth
spending a token on.

A re-roll replaces the **entire** reward with a fresh random one — you can't keep the old
loot and you can't cherry-pick items — so the only question that matters is whether this
casket is worse than a random one, and whether it's worse by enough to be worth a scarce token.

## Install

The app has to be served over http; Alt1 won't load it off the filesystem. Nothing needs
installing to run it — **double-click `serve.cmd`**.

It serves this folder with whatever it finds on the PC, trying `node`, then `py`, then
`python`, then `python3`. A console window opens and prints:

```
alt1://addapp/http://localhost:8231/appconfig.json
```

Paste that into the address bar of **Alt1's own browser** and the app installs. Give it
**screen capture** permission when Alt1 asks — that's what the reading depends on. Leave the
console window open while you play; closing it stops the server.

Pass a port as an argument (`serve.cmd 9000`) if 8231 is taken. The server binds to
127.0.0.1 only, so it isn't reachable from anywhere else and Windows won't ask about the firewall.

`npm install` is only for the development tools (the test runner and the calibration script) —
it's already been run, `node_modules` is in the folder, and the app itself has no runtime
dependencies at all.

### Hosting it on GitHub Pages instead

The folder is a static site with no build step, so putting it on GitHub Pages gives you a
permanent install URL and you never run the server again.

With GitHub Desktop: **File > Add local repository**, point it at this folder (it already is a
git repo with history), then **Publish repository** - name it `clue-reroll-advisor` and untick
"Keep this code private", since Pages needs a public repo on a free account.

Then on github.com: **Settings > Pages > Source: Deploy from a branch > main > / (root) > Save**.

Install from `alt1://addapp/https://<you>.github.io/clue-reroll-advisor/appconfig.json`.
`.nojekyll` is already in place so Pages serves the folder as-is, and `node_modules` is
gitignored so it never gets uploaded.

## Using it

Pick the clue tier at the top — the interface doesn't say which tier a casket came from, so
this is the one thing the app can't read for you. It remembers your last choice.

With **Watch the screen** on, it polls about once a second and fills itself in when a casket
window is open. **Read screen** does a single read on demand. The value, token and cap boxes
are editable, so it works as a plain calculator with Alt1 closed too.

Three verdicts:

| Verdict | When | Why |
|---|---|---|
| **Re-roll** | below the tier's p33 | Bottom third of caskets. You earn a token every 3 clues, so re-rolling roughly the worst third is what you can afford long-run. |
| **Keep — bank the token** | between p33 and the mean | A re-roll is worth slightly more on average, but not enough to burn a scarce token. Unless you're at the token cap, in which case the next token you earn would be wasted, and it flips to re-roll. |
| **Keep** | above the mean | A re-roll loses value in expectation, and you can't undo it. |

Set **Cap** to 5 if you have 4+ pieces of the globetrotter outfit.

## The numbers

Built by Monte Carlo (400,000 caskets per tier) over the wiki reward tables in `data/`:

| Tier | Re-roll below (p33) | Typical (median) | Break-even (mean) | Wiki's stated average | Rolls |
|---|---|---|---|---|---|
| easy | 10,796 | 17,115 | 261,483 | 422,271 | 2-4 |
| medium | 25,869 | 36,303 | 368,483 | 591,476 | 3-5 |
| hard | 121,142 | 140,815 | 646,822 | 1,015,641 | 4-6 |
| elite | 124,572 | 162,339 | 2,736,402 | 2,931,714 | 4-6 |
| master | 274,003 | 374,327 | 5,000,666 | 4,614,535 | 6-6 |

The gap between median and mean is the whole story: most caskets are junk worth tens of
thousands, and the average is carried by a minority that contain one ~700k-1M item (and, rarely,
a dye or a third age piece). A medium casket at 678k is above the average *and* only beats about
69% of caskets — that isn't a contradiction, it's what a distribution this skewed looks like.

### Assumptions, and where they're soft

Per reward spot the model picks a table, then an item from it weighted by the listed rarity:

* `P(unique)` = the sum of the tier's listed unique rarities (the wiki gives those as per-spot odds).
* `P(shared)` = 25% of what's left (29% for hard, from the slot structure described on
  *Treasure Trails/Rewards*). The shared and common tables have almost identical expected value,
  so this split barely moves the result.
* Everything else comes from the common table.

Known soft spots, all recorded here rather than hidden in the data:

* The wiki's published casket averages are **higher** than this model's means for easy/medium/hard
  (by ~35-40%), and close for elite/master. The wiki doesn't publish its table-selection weights,
  and the listed per-spot rarities don't sum to 1, so the two can't be reconciled from the tables
  alone. The thresholds that matter (p33, the mean) sit either side of the same junk-vs-jackpot
  cliff under either reading, so the verdicts are stable — but treat the exact gp figures as
  guide rails, not gospel.
* The **hard shared table** wasn't in the page fetch and is interpolated between the medium and
  elite ones. A few easy shared rows are interpolated the same way. Shared items are all low value,
  so this moves nothing meaningful.
* The **elite shared table** is truncated to what the source page returned; it's normalised within
  the table, so the shape is right even though rows are missing.
* Item prices drift daily. Re-run the model when they've moved enough to matter.

Regenerate after editing the CSVs:

```
npm run model        # rewrites data/model.json
npm test
```

## When it can't find the window

The app finds the interface by matching the pixels of the constant text
"CURRENT REWARD VALUE" (`src/anchor.js`). That template was cut at 100% interface scale. If you
run the game at a different scale the text is drawn at a different size and the match fails —
the status line will say so.

Take a **lossless PNG** screenshot of the open casket window at your own settings and:

```
node tools/calibrate.js shot.png            # inspect: finds the line, shows the box it would cut
node tools/calibrate.js shot.png --write    # rewrite src/anchor.js from it
npm test shot.png                           # confirm the whole pipeline reads it back
```

Calibrate re-derives the template box, the read offsets, and self-tests that the new template
finds itself exactly once before writing anything.

## Tests

```
npm test                  # 45 checks: decision logic, model sanity, value parsing
npm test some-shot.png    # +3 more: the full screen-reading path against a screenshot
```

## Layout

```
index.html  style.css       the app window
src/anchor.js               pixel template for "CURRENT REWARD VALUE" + read offsets
src/reader.js               find the window, OCR the three lines off it
src/advice.js               the decision logic (pure, unit tested)
src/app.js                  UI wiring, polling, overlay
data/*.csv                  reward tables, one per tier
data/build_model.py         Monte Carlo -> data/model.json
data/model.json             quantile grids and thresholds the app ships with
tools/serve.js              static server that prints the alt1:// install link
tools/calibrate.js          regenerate the anchor template from a screenshot
vendor/                     @alt1/base, @alt1/ocr and the aa_9px_mono_allcaps font (MIT, Skillbert)
```

The interface text is read with `aa_9px_mono_allcaps`, the small-caps font RS3 uses for that
window; the value, the "REROLL PROGRESS - x/3" line and the token count in the button label all
come from OCR at fixed offsets from the anchor.

## Credit

Reward data from the [RuneScape Wiki](https://runescape.wiki/w/Treasure_Trails/Rewards).
Alt1 and its libraries by Skillbert.
