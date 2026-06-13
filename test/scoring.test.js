/*
 * Lightweight tests for the RRS Appendix A scoring engine.
 * Run with:  node test/scoring.test.js
 * No dependencies — uses a tiny assert helper and exits non-zero on failure.
 */
const Scoring = require('../js/scoring.js');

let passed = 0, failed = 0;
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error('FAIL: ' + msg + '\n  expected ' + e + '\n  got      ' + a); }
}
function approx(actual, expected, msg) {
  if (Math.abs(actual - expected) < 1e-9) { passed++; }
  else { failed++; console.error('FAIL: ' + msg + '\n  expected ' + expected + ' got ' + actual); }
}

// ---- helpers to build a regatta ----
function boat(id, fleetId) { return { id: id, sail: id, name: id, skipper: '', fleetId: fleetId || '' }; }
function fin(boatId, pos) { return { boatId: boatId, code: 'FIN', position: pos }; }
function code(boatId, c, pts) { return { boatId: boatId, code: c, position: null, points: pts }; }

// =====================================================================
// 1. Basic low point places
// =====================================================================
(function () {
  const boats = [boat('a'), boat('b'), boat('c'), boat('d')];
  const race = { results: [fin('a', 1), fin('b', 2), fin('c', 3), fin('d', 4)] };
  const m = Scoring.scoreRace(race, boats, 4);
  eq(m.a.points, 1, 'A4: 1st = 1pt');
  eq(m.b.points, 2, 'A4: 2nd = 2pts');
  eq(m.d.points, 4, 'A4: 4th = 4pts');
})();

// =====================================================================
// 2. Penalty scores = entries + 1
// =====================================================================
(function () {
  const boats = [boat('a'), boat('b'), boat('c'), boat('d'), boat('e')]; // 5 entered
  const race = { results: [fin('a', 1), fin('b', 2), code('c', 'DNF'), code('d', 'OCS'), code('e', 'DSQ')] };
  const m = Scoring.scoreRace(race, boats, 5);
  eq(m.c.points, 6, 'DNF = entries+1 = 6');
  eq(m.d.points, 6, 'OCS = entries+1 = 6');
  eq(m.e.points, 6, 'DSQ = entries+1 = 6');
})();

// =====================================================================
// 3. Boats with no result default to DNC = entries + 1
// =====================================================================
(function () {
  const boats = [boat('a'), boat('b'), boat('c')];
  const race = { results: [fin('a', 1)] }; // b and c not entered
  const m = Scoring.scoreRace(race, boats, 3);
  eq(m.b.code, 'DNC', 'default code is DNC');
  eq(m.b.points, 4, 'DNC = entries+1 = 4');
})();

// =====================================================================
// 4. A7 within-race dead-heat tie sharing
// =====================================================================
(function () {
  const boats = [boat('a'), boat('b'), boat('c'), boat('d')];
  // a and b tie for 2nd (both position 2); c finishes after at recorded pos 3
  const race = { results: [fin('a', 1), fin('b', 2), fin('c', 2), fin('d', 4)] };
  const m = Scoring.scoreRace(race, boats, 4);
  eq(m.a.points, 1, 'A7: leader still 1');
  approx(m.b.points, 2.5, 'A7: tie for 2nd/3rd => 2.5');
  approx(m.c.points, 2.5, 'A7: tie for 2nd/3rd => 2.5');
  eq(m.d.points, 4, 'A7: next boat scores 4th');
})();

// =====================================================================
// 5. DNE is non-excludable; others excludable
// =====================================================================
(function () {
  const boats = [boat('a')];
  const race = { results: [code('a', 'DNE')] };
  const m = Scoring.scoreRace(race, boats, 5);
  eq(m.a.excludable, false, 'DNE not excludable');
  eq(m.a.points, 6, 'DNE = entries+1');
})();

// =====================================================================
// 6. Discard selection — drop worst excludable, earliest on ties
// =====================================================================
(function () {
  const scores = [
    { points: 1, excludable: true, raceIndex: 0 },
    { points: 5, excludable: true, raceIndex: 1 },
    { points: 5, excludable: true, raceIndex: 2 },
    { points: 2, excludable: true, raceIndex: 3 },
  ];
  const ex = Scoring.chooseDiscards(scores, 1);
  eq([...ex], [1], 'drop one worst (5), earliest race index 1');
  const ex2 = Scoring.chooseDiscards(scores, 2);
  eq([...ex2].sort(), [1, 2], 'drop two worst (both 5s)');
})();

(function () {
  // non-excludable worst is NOT dropped
  const scores = [
    { points: 9, excludable: false, raceIndex: 0 }, // DNE-like, can't drop
    { points: 4, excludable: true, raceIndex: 1 },
    { points: 1, excludable: true, raceIndex: 2 },
  ];
  const ex = Scoring.chooseDiscards(scores, 1);
  eq([...ex], [1], 'non-excludable worst kept; drop next worst (4)');
})();

// =====================================================================
// 7. discardsAllowed schedule
// =====================================================================
(function () {
  const sched = [{ races: 0, discards: 0 }, { races: 4, discards: 1 }, { races: 8, discards: 2 }];
  eq(Scoring.discardsAllowed(sched, 3), 0, '3 races -> 0 discards');
  eq(Scoring.discardsAllowed(sched, 4), 1, '4 races -> 1 discard');
  eq(Scoring.discardsAllowed(sched, 9), 2, '9 races -> 2 discards');
})();

// =====================================================================
// 8. A8.1 tie-break: best-to-worst counted scores
// =====================================================================
(function () {
  // a: [1,4] b:[2,3] => totals 5 and 5. Sorted: a=[1,4], b=[2,3].
  // First element 1 < 2 -> a wins.
  const a = { counted: [1, 4], all: [1, 4] };
  const b = { counted: [2, 3], all: [2, 3] };
  const r = Scoring.tieBreak(a, b);
  eq(r < 0, true, 'A8.1: boat with the better single race wins the tie');
})();

// =====================================================================
// 9. A8.2 tie-break: last race when A8.1 cannot separate
// =====================================================================
(function () {
  // identical multisets [1,2] vs [2,1] -> A8.1 equal. Last race: a=2, b=1 -> b wins.
  const a = { counted: [1, 2], all: [1, 2] };
  const b = { counted: [2, 1], all: [2, 1] };
  const r = Scoring.tieBreak(a, b);
  eq(r > 0, true, 'A8.2: better score in last race wins');
})();

// =====================================================================
// 10. Full fleet integration with discards + ranking
// =====================================================================
(function () {
  const reg = {
    boats: [boat('a'), boat('b'), boat('c')],
    fleets: [],
    discardSchedule: [{ races: 0, discards: 0 }, { races: 3, discards: 1 }],
    races: [
      { id: 'r1', number: 1, results: [fin('a', 1), fin('b', 2), fin('c', 3)] },
      { id: 'r2', number: 2, results: [fin('a', 1), fin('b', 2), fin('c', 3)] },
      { id: 'r3', number: 3, results: [fin('c', 1), fin('a', 2), code('b', 'DNF')] },
    ],
  };
  const data = Scoring.scoreFleet(reg, 'all');
  eq(data.discardsAllowed, 1, '3 races -> 1 discard allowed');
  const byId = {};
  data.rows.forEach(function (row) { byId[row.boat.id] = row; });
  // a: scores 1,1,2 -> drop worst(2) -> total 2
  eq(byId.a.total, 2, 'A total after discard = 2');
  // b: 2,2,DNF(4) -> drop 4 -> total 4
  eq(byId.b.total, 4, 'B total after discard = 4');
  // c: 3,3,1 -> drop worst 3 -> total 4
  eq(byId.c.total, 4, 'C total after discard = 4');
  eq(byId.a.rank, 1, 'A is first');
  // b vs c tie at 4: A8.1 counted: b=[2,2]? after discard b counted=[2,2]; c counted=[3,1]
  // sorted b=[2,2], c=[1,3] -> first elem 1<2 -> c ranks ahead of b
  eq(byId.c.rank, 2, 'C wins tie-break over B (A8.1)');
  eq(byId.b.rank, 3, 'B third');
})();

// =====================================================================
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
