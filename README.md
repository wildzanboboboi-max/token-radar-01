# Token Radar — token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/wildzanboboboi-max/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/wildzanboboboi-max/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Build the best token launch radar. It reads a sealed snapshot of every protocol DefiLlama tracks (758 protocols, snapshot 2026-11-14), works out which ones record no token and are not a wrapped or staked product of one that trades, and ranks them by what their launch would be worth — then hands in a web dashboard with the board, a detail view for each protocol, and the steps to farm it.

## What it does

- **Board:** 178 ranked rows — all 40 watchlist protocols (TVL ≥ $50M, no token on record) plus 138 early pre-token protocols below the floor, by TVL. Every row carries an implied value and a 6-step farm plan with a cost and a time on each step.
- **Model (radar-2), derived from the snapshot alone, no name ever special-cased:**
  - *Comparable:* median market-cap / TVL of live-token protocols in the same category (≥4 of them), shrunk toward the overall median, clamped 0.05–0.65.
  - *Growth:* 7-day TVL change clamped to −50%…+100%, weight 0.6.
  - *Maturity:* days since first listed (up to 3 years): 0.65 + up to 0.35.
  - *Breadth:* +1.5% per extra chain, up to 8 chains.
  - `implied = round(TVL × comparable × growth × maturity × breadth)`
- **Dashboard:** sortable, filterable board (search, category, chain, min TVL, watchlist-only, growing-only), a detail view per protocol (model breakdown, farm plan, snapshot-only risk heuristics), a separate Live-token view (already-trading protocols set aside, with their market caps), and a model sandbox that re-ranks the board live.
- **Honest limits, stated in the dashboard:** “records no token” is DefiLlama’s record, never proof a token does not exist; implied value is the entry’s own claim, not a price, and it does not predict whether or when a token is issued. Risk heuristics use only snapshot fields — the snapshot carries no holder, contract or liquidity data, so there are no mint-authority or holder-concentration checks to claim.

## Run it

Requires Node.js 22.18 or later. No dependencies, no API key, no network at run time — the program reads the sealed snapshot bundled in `input/snapshot.json` (the same bytes the grader mounts at `/input/snapshot.json`).

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
# or: node main.ts --input input/snapshot.json --output out
```

That writes `out/board.json` (178 rows), `out/data.js`, `out/dashboard/`, `out/screenshots/` and `out/dossier.json`. The run is deterministic: same snapshot in, same bytes out. Then open the dashboard:

```sh
# serve out/ (any static server), then open http://localhost:8000/dashboard/
python3 -m http.server 8000 --directory out
# or open out/dashboard/index.html directly in a browser
```

## Take the 3 screenshots

Open the dashboard in a browser at a 1440×900 window and capture:

1. `screenshots/1-board.png` — the board (`dashboard/index.html`)
2. `screenshots/2-detail.png` — a protocol’s detail view (`dashboard/index.html#p=steakhouse-financial`, then click any row)
3. `screenshots/3-filtered.png` — a filtered view (`dashboard/index.html#category=Risk%20Curators&watchlist=1`)

Each must be a whole PNG or JPEG, ≤ 512 KiB (aim 300–350 KiB), long side ≤ 1440 px, short side ≥ 800 px. After replacing them, re-run `node main.ts` so `out/` (and `dossier.json`) pick up the new images.

## Submit (via the make.fun kit — NOT done yet)

1. Download the kit and unpack it: `curl -sSL "https://make.fun/c/token-radar-01/kit" | tar xz`
2. Create a **new public GitHub repo after 2026-11-14** (competition open), copy this folder in as its first commit — including `.makefun/owner.json` (wallet `7CYDUixSttvMBECbfnv8utWTBbUPxhcDbB7aUzVM1b9g`) and the MIT `LICENSE`. Set the repo About as noted at the top.
3. Bundle the transcripts of the agent sessions that built the entry, from inside the unpacked kit:
   `node cli/makefun.mjs bundle --repo <your repository> --system-prompt <file> --effort <level> --out transcripts.tar.gz`
4. Pre-submit check: `node cli/makefun.mjs check --kit . --repo <your repository> --transcripts transcripts.tar.gz`
5. Submit (signs the entry message with the wallet keypair — the user runs this; the keypair file is never in this repo):
   `node cli/makefun.mjs submit --competition token-radar-01 --repo-url https://github.com/<owner>/<repo> --commit <40-char sha> --title "Token Radar" --bundle transcripts.tar.gz --keypair wallet.json`
6. Follow it: `node cli/makefun.mjs status --submission <id>`

Without a GitHub account, enter a source bundle instead: run the kit’s `init` in the empty new repo **before** adding any files, then submit with `--source` — see the kit’s `RULES.txt`, “Enter” step 5. Deadline: **2026-12-14 10:00 UTC / 17:00 WIB**. At most 5 submissions a day, 10 in all; the last submission before the deadline is the final entry.

## Layout

```
main.ts                  entrypoint (Node 22, stdlib only)
lib/model.ts             the radar-2 model, farm plans, risk heuristics
vendor/makefun-board.ts  make.fun dossier library, verbatim from the kit
dashboard/               index.html + app.css + app.js (static, no network)
input/snapshot.json      sealed DefiLlama snapshot (2026-11-14) for local runs
screenshots/             1-board, 2-detail, 3-filtered
.makefun/owner.json      claim file naming the payout wallet
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
