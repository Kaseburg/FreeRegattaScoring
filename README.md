# ⛵ Free Regatta Scoring

A simple but comprehensive web app for **creating and scoring one-design sailing
regattas** under the **US Sailing Racing Rules of Sailing (RRS) 2025–2028,
Appendix A — Low Point System**.

Built for **one-design fleet racing** — all boats are rated equal, so finishing
order *is* the score (no handicap correction). Standings are calculated
automatically with penalty scores, discards, and the Appendix A tie-break
procedures.

> No installation, no account, no server. It runs entirely in the browser and
> stores your regatta privately in `localStorage`. Use **Export/Import** to back
> up or move data between devices.

## Two ways to score

### ⚡ Easy — start scoring now (pickup regattas)

One click starts a **pickup regatta** with the most common informal defaults, so
there's nothing to set up. You just:

1. Type a **sail number** and press <kbd>Enter</kbd> as each boat finishes.
   New sail numbers are added automatically.
2. Click **Save & Start Next Race** and do the same.
3. Click **Finish & Score Regatta** at the end — done.

The defaults Easy mode applies (all editable, and listed as **assumptions** on
the results page):

- **Low Point System** (RRS Appendix A4).
- **One throwout (discard) once 4 or more races are completed.**
- Penalty/DNF codes score **(boats entered) + 1**.
- Boats not entered in a race are scored **DNC**.

### Set Up a Regatta (full control)

For scheduled events: enter name, venue, dates, optional fleets/divisions, and a
custom discard schedule; manage the boat list; and use the detailed race screen
(tap-to-finish columns, per-boat codes, redress points).

## Features

- **Phone-first** — the whole workflow (set up, enter finishers, score) runs on
  a phone. A thumb-reachable bottom tab bar switches between Boats, Races,
  Results, and Settings; the header's backup actions collapse into a menu; forms
  stack full width and tables scroll with a pinned position column.
- **Easy / Quick Entry** — score a whole regatta by typing sail numbers in
  finishing order; auto-creates boats; auto-applies pickup-regatta defaults.
- **Editable anytime** — once a regatta is in progress you can change its
  settings (name, fleets, number of throwouts, etc.) from the **Settings** tab
  or the ⚙ Settings button on the Quick Entry and Results pages; changes
  re-score the standings immediately.
- **Regatta setup** — name, organizing authority, venue, dates.
- **Fleets / divisions** — optional; score one-design classes separately or all
  together.
- **Boats / competitors** — sail number, boat name, skipper, class, fleet.
  Inline editing.
- **Detailed finish entry** — tap boats in finishing order; reorder, undo, or
  assign a scoring code. "Mark remaining DNC" closes out a race in one click.
- **Scoring codes (RRS A11)** — OCS, UFD, BFD, DNF, DNS, DNC, RET, DSQ, DNE,
  and RDG (manual redress points).
- **Automatic results** — scoring assumptions stated in plain English, per-race
  scores, discards, totals, and ranking with tie-breaks; printable and
  exportable to CSV.

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
