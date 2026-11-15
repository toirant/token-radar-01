# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/toirant/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/toirant/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar — the best token launch radar. A program (`main.ts`, Node 22, standard library only) reads a sealed DefiLlama snapshot of 758 protocols, scores every pre-token protocol by an implied value, and writes a ranked board plus a static dashboard a reader can actually farm from.

## The model (radar-2)

Implied value follows only from the snapshot's own figures — no protocol name is ever special-cased:

```
implied = round( tvl_usd × category multiple × growth × maturity × breadth )
```

- **Category multiple** — the snapshot's own comparable: the median market-cap-to-TVL ratio of the live-token protocols in the same category (at least 4 comparables), else the live market's median of 0.21×, clamped to 0.05–1.0. A Dexs protocol is priced like live Dexs protocols (0.34×), a lending protocol like live lending protocols (0.13×).
- **Growth** — `1 + clamp(change_7d, −60, 120) / 100 × 0.5`.
- **Maturity** — `0.6 + min(age_days, 1095) / 1095 × 0.4`; age is the time since the protocol was first listed, the best record of how long it has run with no token (unknown age uses 365 days).
- **Breadth** — `1 + 0.04 × min(chains − 1, 5)`: more chains, wider distribution, up to 1.20×.

The board covers all 40 watchlist protocols (the floor, never the ceiling) and adds 143 pre-token protocols below the $50M floor — the early finds the radar exists to surface — for 183 ranked rows. Live-token protocols are set apart with their market caps shown, and they are the comparables the model prices against.

## The dashboard

A static page, no framework and no network: `dashboard/index.html`, `dashboard/app.css`, `dashboard/app.js`, fed by `data.js` written beside it.

- Sortable board (rank, protocol, TVL, 7-day growth, age, implied value) with search, category and chain filters, watchlist-only and early-finds-only toggles, and a live-token tab.
- A detail view for every protocol: the full model breakdown (TVL, category multiple with its comparable count, growth and maturity multipliers, breadth), a recomputation check against `board.json`, and a 7-step farm plan.
- Farm plans are derived from each protocol's own record (category, chains, TVL, age): the action, the capital, chain-aware gas, a weekly cadence, a hold period, and how to claim safely.
- A model lab: move the growth weight and the multiple scale and the whole board re-ranks live in the page, so a reader can see the model is arithmetic, not a hand-kept list.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node --experimental-strip-types main.ts --input <snapshot.json>
```

`main.ts` reads the snapshot (default `/input/snapshot.json`), writes `/output/board.json`, `/output/data.js`, copies `dashboard/` and `screenshots/` to `/output`, and writes `/output/dossier.json` with `buildDossier` from `vendor/makefun-board.ts`.

---

Entered on [make.fun](https://make.fun/?ref=0dhzvgtg&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards
