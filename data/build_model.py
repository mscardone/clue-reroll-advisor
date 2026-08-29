#!/usr/bin/env python3
"""Build data/model.json: casket value distributions per clue tier.

Model (documented in README):
  Each casket rolls N reward spots, N uniform over the tier's [min,max].
  Each spot independently picks one table:
      P(unique)  = sum of the listed unique rarities (they are per-spot odds)
      P(shared)  = sharedShare * (1 - P(unique))
      P(commons) = the remainder
  then one item from that table with weight proportional to its listed rarity.
  Quantity/value ranges are sampled uniformly.
"""
import csv, json, random, os
from fractions import Fraction

HERE = os.path.dirname(os.path.abspath(__file__))
random.seed(20260829)
N_SIM = 400_000

TIERS = {
    "easy":   {"rolls": [2, 4], "wikiAvg": 422271,   "sharedShare": 0.25},
    "medium": {"rolls": [3, 5], "wikiAvg": 591476,   "sharedShare": 0.25},
    "hard":   {"rolls": [4, 6], "wikiAvg": 1015641,  "sharedShare": 0.29},
    "elite":  {"rolls": [4, 6], "wikiAvg": 2931714,  "sharedShare": 0.25},
    "master": {"rolls": [6, 6], "wikiAvg": 4614535,  "sharedShare": 0.25},
}

def parse_value(v):
    v = v.strip()
    if v in ("", "0", "Not sold"):
        return (0.0, 0.0)
    if "-" in v:
        a, b = v.split("-", 1)
        return (float(a), float(b))
    return (float(v), float(v))

def load(tier):
    tables = {"uniques": [], "commons": [], "shared": []}
    with open(os.path.join(HERE, tier + ".csv")) as f:
        for row in csv.DictReader(f):
            if not row["table"] or row["table"].startswith("#"):
                continue
            p = float(Fraction(row["rarity"].strip()))
            lo, hi = parse_value(row["value"])
            tables[row["table"].strip()].append(
                {"item": row["item"], "p": p, "lo": lo, "hi": hi})
    return tables

def cumulative(rows):
    tot = sum(r["p"] for r in rows)
    acc, out = 0.0, []
    for r in rows:
        acc += r["p"] / tot
        out.append((acc, r))
    return out, tot

def pick(cum):
    x = random.random()
    for c, r in cum:
        if x <= c:
            return r
    return cum[-1][1]

def table_ev(rows):
    tot = sum(r["p"] for r in rows)
    return sum(r["p"] / tot * (r["lo"] + r["hi"]) / 2 for r in rows)

out = {"generated": "2026-08-29", "nSim": N_SIM, "tiers": {}}
for tier, cfg in TIERS.items():
    t = load(tier)
    cum_u, p_unique = cumulative(t["uniques"])
    cum_s, _ = cumulative(t["shared"])
    cum_c, _ = cumulative(t["commons"])
    p_unique = min(p_unique, 0.5)
    p_shared = cfg["sharedShare"] * (1 - p_unique)
    lo_rolls, hi_rolls = cfg["rolls"]

    vals = []
    for _ in range(N_SIM):
        n = random.randint(lo_rolls, hi_rolls)
        total = 0.0
        for _ in range(n):
            x = random.random()
            cum = cum_u if x < p_unique else (cum_s if x < p_unique + p_shared else cum_c)
            r = pick(cum)
            total += r["lo"] if r["hi"] == r["lo"] else random.uniform(r["lo"], r["hi"])
        vals.append(total)
    vals.sort()

    # 201-point quantile grid (0%, 0.5% ... 100%)
    grid = [vals[min(len(vals) - 1, int(round(i / 200 * (len(vals) - 1))))] for i in range(201)]
    mean = sum(vals) / len(vals)

    # biggest expected-value contributors, for the "what you're playing for" list
    drivers = []
    for name, rows, weight in (("unique", t["uniques"], p_unique),
                               ("shared", t["shared"], p_shared),
                               ("common", t["commons"], 1 - p_unique - p_shared)):
        tot = sum(r["p"] for r in rows)
        for r in rows:
            per_spot = weight * r["p"] / tot
            drivers.append({"item": r["item"], "table": name,
                            "pPerSpot": per_spot,
                            "value": (r["lo"] + r["hi"]) / 2,
                            "ev": per_spot * (r["lo"] + r["hi"]) / 2})
    drivers.sort(key=lambda d: -d["ev"])

    avg_rolls = (lo_rolls + hi_rolls) / 2
    out["tiers"][tier] = {
        "rolls": cfg["rolls"],
        "wikiAvgCasket": cfg["wikiAvg"],
        "simMean": round(mean),
        "simMedian": round(grid[100]),
        "p33": round(grid[66]),
        "p10": round(grid[20]),
        "p90": round(grid[180]),
        "p99": round(grid[198]),
        "pUniquePerSpot": round(p_unique, 5),
        "pSharedPerSpot": round(p_shared, 5),
        "evPerSpot": round(mean / avg_rolls),
        "quantiles": [round(v) for v in grid],
        "drivers": [{"item": d["item"], "chancePerCasket": round(1 - (1 - d["pPerSpot"]) ** avg_rolls, 6),
                     "value": round(d["value"])} for d in drivers[:12]],
    }
    print(f"{tier:7s} mean={mean:12,.0f} wiki={cfg['wikiAvg']:12,d} "
          f"median={grid[100]:10,.0f} p33={grid[66]:10,.0f} p90={grid[180]:12,.0f} "
          f"pUnique/spot={p_unique:.4f}")

with open(os.path.join(HERE, "model.json"), "w") as f:
    json.dump(out, f, separators=(",", ":"))
print("wrote model.json", os.path.getsize(os.path.join(HERE, "model.json")), "bytes")
