# ⛵ Free Regatta Scoring

A simple but comprehensive web app for **creating and scoring sailing regattas**
under the **US Sailing Racing Rules of Sailing (RRS) 2025–2028, Appendix A —
Low Point System**.

Set up a regatta with the minimum necessary details, add your boats, then tap
finishers **in the order they cross the line** (or mark OCS, DNF, DNS, DSQ, and
other codes). Standings are calculated automatically with penalty scores,
discards, and the Appendix A tie-break procedures.

> No installation, no account, no server. It runs entirely in the browser and
> stores your regatta privately in `localStorage`. Use **Export/Import** to back
> up or move data between devices.

## Features

- **Regatta setup** — name, organizing authority, venue, dates.
- **Fleets / divisions** — optional; score classes separately or all together.
- **Boats / competitors** — sail number, boat name, skipper, class, fleet,
  optional rating. Inline editing.
- **Fast finish entry** — tap boats in finishing order; reorder, undo, or assign
  a scoring code. "Mark remaining DNC" closes out a race in one click.
- **Scoring codes (RRS A11)** — OCS, UFD, BFD, DNF, DNS, DNC, RET, DSQ, DNE,
  and RDG (manual redress points).
- **Automatic results** — per-race scores, discards, totals, and ranking with
  tie-breaks; printable and exportable to CSV.

## Scoring rules implemented (RRS 2025–2028, Appendix A)

| Rule | What the app does |
|------|-------------------|
| **A4** Low Point System | 1st = 1 pt, 2nd = 2 pts, 3rd = 3 pts, … |
| **A5 / A4.2** Penalty scores | DNC, DNS, OCS, UFD, BFD, DNF, RET, DSQ score **(boats entered) + 1** |
| **A11** DNE | Scores (entered) + 1 and is **never discarded** |
| **A7** Within-race ties | Tied places are added together and **shared equally** (e.g. tie for 2nd → 2.5) |
| **A2** Series score & discards | Sum of race scores **excluding the worst** per the discard schedule; earliest race dropped on equal worst scores |
| **A8.1** Series ties | Each boat's counted scores listed best→worst and compared; excluded scores not used |
| **A8.2** Remaining ties | Broken by score in the last race, then next-to-last, etc. (uses all scores) |

Boats left blank when a race is closed are scored **DNC** by default.

> ⚠️ Always confirm final results against the official rules and your event's
> Sailing Instructions. Redress (RDG) and any discretionary penalties must be
> entered by the race/protest committee.

## Usage

Because everything is client-side, just open `index.html`.

```bash
# Option A: open the file directly
open index.html            # macOS  (use xdg-open on Linux)

# Option B: serve locally (recommended)
python3 -m http.server 8000
# then visit http://localhost:8000
```

Click **Load Sample Data** on the welcome screen to see a worked two-fleet
example.

### Deploying

It's a static site — host the folder anywhere (GitHub Pages, Netlify, S3, a
club server). No build step required.

## Project structure

```
index.html          App shell and all views
css/styles.css      Styling (responsive + print)
js/scoring.js       RRS Appendix A scoring engine (framework-free, testable)
js/storage.js       localStorage persistence, import/export, sample data
js/app.js           UI controller wiring views to the engine
test/scoring.test.js  Unit tests for the scoring engine
```

## Tests

The scoring engine has no dependencies and is unit-tested with plain Node:

```bash
node test/scoring.test.js
```

## License

MIT — see `LICENSE`.
