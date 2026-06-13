/*
 * scoring.js — Scoring engine implementing the US Sailing
 * Racing Rules of Sailing (RRS) 2025–2028, Appendix A: Low Point System.
 *
 * Reference: https://www.ussailing.org/competition/rules-officiating/the-racing-rules-of-sailing-2025-2028/
 *
 * Key rules implemented:
 *  - A4   Low Point System: 1st = 1pt, 2nd = 2pts, ... each place +1.
 *  - A5/A4.2 Penalty scores: a boat that did not start, did not finish,
 *           retired after finishing, was disqualified, or broke a rule 30
 *           start penalty is scored points for the finishing place one more
 *           than the number of boats entered in the series  ((entries) + 1).
 *  - A2   Series score = sum of race scores, excluding the worst score(s)
 *           per the discard schedule. Non-excludable scores (DNE) are never
 *           discarded.
 *  - A7   Within-race ties (e.g. equal corrected times / dead heat): the
 *           points for the tied place and the place(s) below are added and
 *           shared equally.
 *  - A8.1 Series ties broken by listing each boat's scores best-to-worst and
 *           comparing; excluded scores are NOT used.
 *  - A8.2 Remaining ties broken by scores in the last race, then next-to-last,
 *           etc.; excluded scores ARE used here.
 *  - A11  Scoring abbreviations.
 *
 * This module is framework-free and side-effect-free so it can be unit tested.
 */
(function (global) {
  'use strict';

  // RRS A11 scoring abbreviations. `penalty: true` means the boat scores
  // (entries + 1). `excludable: false` means the score may never be discarded.
  const CODES = {
    FIN: { label: 'Finished', desc: 'Finished normally', penalty: false, excludable: true },
    DNC: { label: 'DNC', desc: 'Did not start; did not come to the starting area', penalty: true, excludable: true },
    DNS: { label: 'DNS', desc: 'Did not start (other than DNC and OCS)', penalty: true, excludable: true },
    OCS: { label: 'OCS', desc: 'On the course side at her starting signal, or broke rule 30.1', penalty: true, excludable: true },
    UFD: { label: 'UFD', desc: 'Disqualification under rule 30.3 (U flag)', penalty: true, excludable: true },
    BFD: { label: 'BFD', desc: 'Disqualification under rule 30.4 (black flag)', penalty: true, excludable: true },
    DNF: { label: 'DNF', desc: 'Did not finish', penalty: true, excludable: true },
    RET: { label: 'RET', desc: 'Retired after finishing', penalty: true, excludable: true },
    DSQ: { label: 'DSQ', desc: 'Disqualification', penalty: true, excludable: true },
    DNE: { label: 'DNE', desc: 'Disqualification (not excludable) — e.g. rule 2 or 69', penalty: true, excludable: false },
    RDG: { label: 'RDG', desc: 'Redress given — enter points manually', penalty: false, excludable: true },
  };

  // Order shown in the penalty/code menu.
  const CODE_ORDER = ['OCS', 'UFD', 'BFD', 'DNF', 'DNS', 'DNC', 'RET', 'DSQ', 'DNE', 'RDG'];

  function isPenaltyCode(code) {
    return !!(CODES[code] && CODES[code].penalty);
  }
  function isExcludable(code) {
    return !CODES[code] || CODES[code].excludable !== false;
  }

  /**
   * Boats entered in the series for a given fleet.
   * Per RRS the penalty score is based on boats *entered in the series*.
   */
  function enteredCount(regatta, fleetId) {
    const boats = boatsInFleet(regatta, fleetId);
    return boats.length;
  }

  function boatsInFleet(regatta, fleetId) {
    if (!fleetId || fleetId === 'all') return regatta.boats.slice();
    return regatta.boats.filter(function (b) { return b.fleetId === fleetId; });
  }

  /**
   * Races that apply to a fleet. A race with fleetId 'all' (or empty) counts
   * for every fleet; otherwise only its own fleet.
   */
  function racesForFleet(regatta, fleetId) {
    return regatta.races.filter(function (r) {
      if (!fleetId || fleetId === 'all') return true;
      return !r.fleetId || r.fleetId === 'all' || r.fleetId === fleetId;
    });
  }

  /**
   * Compute every boat's score for a single race.
   *
   * @param {Object} race    Race object with a `results` array of
   *                         { boatId, code, position, points? } entries.
   * @param {Array}  boats   Boats eligible in this race (the fleet).
   * @param {number} entries Number of boats entered in the series (for penalties).
   * @returns {Object} map boatId -> { code, position, points, excludable, finisher }
   */
  function scoreRace(race, boats, entries) {
    const penaltyPoints = entries + 1;
    const byBoat = {};
    const resultByBoat = {};
    (race.results || []).forEach(function (r) { resultByBoat[r.boatId] = r; });

    // 1) Collect finishers and their finishing positions.
    const finishers = [];
    boats.forEach(function (b) {
      const r = resultByBoat[b.id];
      if (r && (r.code === 'FIN' || !r.code) && r.position != null) {
        finishers.push({ boatId: b.id, position: r.position });
      }
    });
    // Sort by recorded finishing position.
    finishers.sort(function (a, b) { return a.position - b.position; });

    // 2) Assign Low Point places (A4), handling A7 dead-heat ties where two
    //    boats share the same recorded position.
    //    Group by equal position; a group of size n starting at place p gets
    //    the average of places p..p+n-1.
    let place = 1;
    let i = 0;
    while (i < finishers.length) {
      let j = i;
      while (j < finishers.length && finishers[j].position === finishers[i].position) j++;
      const groupSize = j - i;
      // places place .. place+groupSize-1
      let sum = 0;
      for (let k = 0; k < groupSize; k++) sum += (place + k);
      const shared = sum / groupSize;
      for (let k = i; k < j; k++) {
        byBoat[finishers[k].boatId] = {
          code: 'FIN',
          place: place,            // finishing place (shared if a dead-heat tie)
          points: shared,
          excludable: true,
          finisher: true,
          tied: groupSize > 1,
        };
      }
      place += groupSize;
      i = j;
    }

    // 3) Everyone else: explicit penalty code, manual redress, or default DNC.
    boats.forEach(function (b) {
      if (byBoat[b.id]) return;
      const r = resultByBoat[b.id];
      const code = (r && r.code && r.code !== 'FIN') ? r.code : 'DNC';

      if (code === 'RDG') {
        // Redress: race committee / protest committee assigns points manually.
        const pts = (r && r.points != null) ? Number(r.points) : penaltyPoints;
        byBoat[b.id] = { code: 'RDG', points: pts, excludable: isExcludable('RDG'), finisher: false };
      } else {
        byBoat[b.id] = {
          code: code,
          points: penaltyPoints,
          excludable: isExcludable(code),
          finisher: false,
        };
      }
    });

    return byBoat;
  }

  /**
   * Decide how many discards are allowed given the number of completed races
   * and the discard schedule.
   *
   * schedule: array of { races: <min completed>, discards: <count> }.
   * The rule with the highest `races` threshold that is <= completed applies.
   */
  function discardsAllowed(schedule, completedRaces) {
    if (!Array.isArray(schedule) || !schedule.length) return 0;
    let allowed = 0;
    let bestThreshold = -1;
    schedule.forEach(function (rule) {
      const thr = Number(rule.races) || 0;
      const dc = Number(rule.discards) || 0;
      if (completedRaces >= thr && thr >= bestThreshold) {
        bestThreshold = thr;
        allowed = dc;
      }
    });
    return allowed;
  }

  /**
   * Determine which of a boat's race scores are excluded (discarded) per A2.
   * Worst (highest) excludable scores are dropped first. Ties in "worst" are
   * broken by dropping the earlier race first (A2.1).
   *
   * @param {Array} raceScores  ordered by race, each { points, excludable, raceIndex }
   * @param {number} allowed     number of discards permitted
   * @returns {Set<number>} set of raceIndex values that are excluded
   */
  function chooseDiscards(raceScores, allowed) {
    const excluded = new Set();
    if (allowed <= 0) return excluded;
    const candidates = raceScores
      .filter(function (s) { return s.excludable; })
      .slice()
      .sort(function (a, b) {
        if (b.points !== a.points) return b.points - a.points; // worst (highest) first
        return a.raceIndex - b.raceIndex;                       // then earliest race
      });
    for (let k = 0; k < Math.min(allowed, candidates.length); k++) {
      excluded.add(candidates[k].raceIndex);
    }
    return excluded;
  }

  /**
   * A8 series tie-break comparator. Returns negative if A ranks ahead of B.
   * @param a,b  { counted: number[], all: number[] }
   *   counted = non-excluded race points; all = every race's points (ordered by race).
   */
  function tieBreak(a, b) {
    // A8.1 — sort each boat's counted scores best (lowest) to worst (highest);
    // compare position by position; lower wins.
    const sa = a.counted.slice().sort(function (x, y) { return x - y; });
    const sb = b.counted.slice().sort(function (x, y) { return x - y; });
    const n = Math.min(sa.length, sb.length);
    for (let i = 0; i < n; i++) {
      if (sa[i] !== sb[i]) return sa[i] - sb[i];
    }
    // A8.2 — compare scores in the last race, then next-to-last, etc.,
    // using ALL scores (excluded ones included).
    for (let i = a.all.length - 1; i >= 0; i--) {
      const va = a.all[i];
      const vb = b.all[i];
      if (va == null || vb == null) continue;
      if (va !== vb) return va - vb;
    }
    return 0;
  }

  /**
   * Compute full standings for one fleet.
   * @returns {Object} {
   *    fleetId, entries, completedRaces, discardsAllowed,
   *    races: [{ id, number, name }],
   *    rows: [{ boat, raceCells:[{code,points,place,excluded,tied}], total, rank, tiedRank }]
   * }
   */
  function scoreFleet(regatta, fleetId) {
    const boats = boatsInFleet(regatta, fleetId);
    const entries = boats.length;
    const races = racesForFleet(regatta, fleetId);

    // A completed race = one that has been marked completed OR has any results.
    const completedRaces = races.filter(function (r) {
      return r.completed || (r.results && r.results.length);
    }).length;

    const allowed = discardsAllowed(regatta.discardSchedule, completedRaces);

    // Per-race scoring maps.
    const raceMaps = races.map(function (r) {
      return scoreRace(r, boats, entries);
    });

    const rows = boats.map(function (boat) {
      const cells = races.map(function (r, ri) {
        const s = raceMaps[ri][boat.id];
        return {
          raceIndex: ri,
          code: s.code,
          points: s.points,
          place: s.place || null,
          finisher: s.finisher,
          excludable: s.excludable,
          tied: !!s.tied,
          excluded: false,
        };
      });

      const excluded = chooseDiscards(
        cells.map(function (c) { return { points: c.points, excludable: c.excludable, raceIndex: c.raceIndex }; }),
        allowed
      );
      cells.forEach(function (c) { if (excluded.has(c.raceIndex)) c.excluded = true; });

      let total = 0;
      cells.forEach(function (c) { if (!c.excluded) total += c.points; });
      total = Math.round(total * 100) / 100;

      const counted = cells.filter(function (c) { return !c.excluded; }).map(function (c) { return c.points; });
      const all = cells.map(function (c) { return c.points; });

      return { boat: boat, cells: cells, total: total, counted: counted, all: all };
    });

    // Rank with A8 tie-breaking.
    rows.sort(function (a, b) {
      if (a.total !== b.total) return a.total - b.total;
      return tieBreak(a, b);
    });

    // Assign ranks; mark genuine ties (where tie-break could not separate).
    rows.forEach(function (row, idx) {
      row.rank = idx + 1;
      if (idx > 0) {
        const prev = rows[idx - 1];
        const sameTotal = prev.total === row.total;
        const unresolved = sameTotal && tieBreak(prev, row) === 0;
        row.tiedRank = unresolved;
        if (unresolved) row.rank = prev.rank;
      }
    });

    return {
      fleetId: fleetId,
      entries: entries,
      completedRaces: completedRaces,
      discardsAllowed: allowed,
      races: races.map(function (r) { return { id: r.id, number: r.number, name: r.name }; }),
      rows: rows,
    };
  }

  const Scoring = {
    CODES: CODES,
    CODE_ORDER: CODE_ORDER,
    isPenaltyCode: isPenaltyCode,
    isExcludable: isExcludable,
    enteredCount: enteredCount,
    boatsInFleet: boatsInFleet,
    racesForFleet: racesForFleet,
    scoreRace: scoreRace,
    discardsAllowed: discardsAllowed,
    chooseDiscards: chooseDiscards,
    tieBreak: tieBreak,
    scoreFleet: scoreFleet,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Scoring;
  }
  global.Scoring = Scoring;
})(typeof window !== 'undefined' ? window : globalThis);
