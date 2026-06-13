/*
 * storage.js — persistence, (de)serialization, IDs, and sample data.
 * Regatta state lives in localStorage so the app works fully offline.
 */
(function (global) {
  'use strict';

  const KEY = 'frs.regatta.v1';

  function uid(prefix) {
    return (prefix || 'id') + '-' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  }

  function emptyRegatta() {
    return {
      version: 1,
      id: uid('reg'),
      name: '',
      organizer: '',
      venue: '',
      startDate: '',
      endDate: '',
      scoringSystem: 'low-point',
      discardSchedule: [{ races: 0, discards: 0 }],
      easyMode: false,     // true when created via the "Easy" pickup-regatta flow
      fleets: [],          // [{ id, name }]
      boats: [],           // [{ id, sail, name, skipper, boatClass, fleetId }]
      races: [],           // [{ id, number, name, date, fleetId, completed, results:[{boatId, code, position, points}] }]
      createdAt: new Date().toISOString(),
    };
  }

  // "Easy" pickup-regatta defaults — the most common informal one-design setup.
  // These are surfaced to the user as assumptions on the results page.
  function easyRegatta() {
    const reg = emptyRegatta();
    const today = new Date().toISOString().slice(0, 10);
    reg.name = 'Pickup Regatta — ' + today;
    reg.startDate = today;
    reg.easyMode = true;
    // One throwout (discard) once 4 or more races have been completed.
    reg.discardSchedule = [{ races: 0, discards: 0 }, { races: 4, discards: 1 }];
    return reg;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return migrate(data);
    } catch (e) {
      console.warn('Could not load saved regatta:', e);
      return null;
    }
  }

  function save(regatta) {
    try {
      localStorage.setItem(KEY, JSON.stringify(regatta));
      return true;
    } catch (e) {
      console.error('Could not save regatta:', e);
      return false;
    }
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  // Forward-compatible normalization of loaded/imported data.
  function migrate(data) {
    const base = emptyRegatta();
    const reg = Object.assign(base, data);
    reg.fleets = Array.isArray(data.fleets) ? data.fleets : [];
    reg.boats = Array.isArray(data.boats) ? data.boats : [];
    reg.races = Array.isArray(data.races) ? data.races : [];
    if (!Array.isArray(reg.discardSchedule) || !reg.discardSchedule.length) {
      reg.discardSchedule = [{ races: 0, discards: 0 }];
    }
    reg.races.forEach(function (r) {
      if (!Array.isArray(r.results)) r.results = [];
    });
    return reg;
  }

  function exportFile(regatta) {
    const blob = new Blob([JSON.stringify(regatta, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safe = (regatta.name || 'regatta').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    a.href = url;
    a.download = safe + '-regatta.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importFile(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        try {
          const data = JSON.parse(reader.result);
          resolve(migrate(data));
        } catch (e) {
          reject(new Error('That file is not a valid regatta backup.'));
        }
      };
      reader.onerror = function () { reject(new Error('Could not read the file.')); };
      reader.readAsText(file);
    });
  }

  // -------- Sample data: a small two-fleet weekend regatta --------
  function sampleRegatta() {
    const reg = emptyRegatta();
    reg.name = 'Harbor Cup Sample Regatta';
    reg.organizer = 'Demo Yacht Club';
    reg.venue = 'Demo Bay';
    reg.startDate = '2026-06-13';
    reg.endDate = '2026-06-14';
    reg.discardSchedule = [
      { races: 0, discards: 0 },
      { races: 4, discards: 1 },
    ];

    const fA = { id: uid('flt'), name: 'Fleet A' };
    const fB = { id: uid('flt'), name: 'Fleet B' };
    reg.fleets = [fA, fB];

    const mk = function (sail, name, skipper, cls, fleetId) {
      return { id: uid('boat'), sail: sail, name: name, skipper: skipper, boatClass: cls, fleetId: fleetId };
    };
    reg.boats = [
      mk('USA 11', 'Wind Dancer', 'A. Skipper', 'J/24', fA.id),
      mk('USA 22', 'Sea Breeze', 'B. Helm', 'J/24', fA.id),
      mk('USA 33', 'Blue Streak', 'C. Tiller', 'J/24', fA.id),
      mk('USA 44', 'Reef Knot', 'D. Mast', 'J/24', fA.id),
      mk('USA 55', 'Tack Attack', 'E. Boom', 'J/24', fA.id),
      mk('USA 101', 'Gust', 'F. Sheet', 'Lightning', fB.id),
      mk('USA 202', 'Spinner', 'G. Halyard', 'Lightning', fB.id),
      mk('USA 303', 'Leeward', 'H. Cleat', 'Lightning', fB.id),
      mk('USA 404', 'Windward', 'I. Shroud', 'Lightning', fB.id),
    ];

    const A = reg.boats.filter(function (b) { return b.fleetId === fA.id; });
    const B = reg.boats.filter(function (b) { return b.fleetId === fB.id; });

    function race(num, fleetId, boats, order, codes) {
      const r = {
        id: uid('race'), number: num, name: 'Race ' + num, date: '',
        fleetId: fleetId, completed: true, results: [],
      };
      order.forEach(function (idx, pos) {
        r.results.push({ boatId: boats[idx].id, code: 'FIN', position: pos + 1 });
      });
      (codes || []).forEach(function (c) {
        r.results.push({ boatId: boats[c.idx].id, code: c.code, position: null });
      });
      return r;
    }

    reg.races = [
      race(1, fA.id, A, [0, 1, 2, 3, 4]),
      race(2, fA.id, A, [1, 0, 3, 2], [{ idx: 4, code: 'DNF' }]),
      race(3, fA.id, A, [2, 0, 1, 4], [{ idx: 3, code: 'OCS' }]),
      race(4, fA.id, A, [0, 2, 1, 3, 4]),
      race(1, fB.id, B, [0, 1, 2, 3]),
      race(2, fB.id, B, [1, 2, 0], [{ idx: 3, code: 'DNS' }]),
      race(3, fB.id, B, [2, 1, 0, 3]),
      race(4, fB.id, B, [3, 0, 1, 2]),
    ];

    return reg;
  }

  const Storage = {
    KEY: KEY,
    uid: uid,
    emptyRegatta: emptyRegatta,
    easyRegatta: easyRegatta,
    load: load,
    save: save,
    clear: clear,
    migrate: migrate,
    exportFile: exportFile,
    importFile: importFile,
    sampleRegatta: sampleRegatta,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Storage;
  }
  global.Storage = Storage;
})(typeof window !== 'undefined' ? window : globalThis);
