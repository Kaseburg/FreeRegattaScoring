/*
 * app.js — UI controller for Free Regatta Scoring.
 * Wires the views (Setup, Boats, Races, Results) to the scoring engine and
 * localStorage persistence.
 */
(function () {
  'use strict';

  const S = window.Scoring;
  const DB = window.Storage;

  let regatta = null;            // current regatta state
  let currentView = 'welcome';
  let currentRaceId = null;      // race open in the detail view

  // ---------- tiny DOM helpers ----------
  const $ = function (sel, root) { return (root || document).querySelector(sel); };
  const $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null && attrs[k] !== false) node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }
  function esc(s) { return (s == null ? '' : String(s)); }

  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); t.hidden = true; }, 2200);
  }

  function persist() { DB.save(regatta); }

  // ---------- navigation ----------
  function showView(view) {
    currentView = view;
    $$('.view').forEach(function (v) { v.hidden = true; });
    const node = $('#view-' + view);
    if (node) node.hidden = false;
    $$('.nav-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.view === view);
    });
    $('#topNav').hidden = !regatta;
    if (view === 'boats') renderBoats();
    if (view === 'races') renderRaces();
    if (view === 'results') renderResults();
    if (view === 'setup') renderSetup();
    window.scrollTo(0, 0);
  }

  // ---------- fleet helpers ----------
  function fleetName(fleetId) {
    if (!fleetId || fleetId === 'all') return 'All boats';
    const f = regatta.fleets.find(function (x) { return x.id === fleetId; });
    return f ? f.name : 'Unknown fleet';
  }
  function fleetOptions(includeAll, selected) {
    const opts = [];
    if (includeAll) opts.push(el('option', { value: 'all', selected: selected === 'all' || !selected ? 'selected' : false }, ['All boats']));
    regatta.fleets.forEach(function (f) {
      opts.push(el('option', { value: f.id, selected: selected === f.id ? 'selected' : false }, [f.name]));
    });
    return opts;
  }

  // =====================================================================
  // SETUP VIEW
  // =====================================================================
  function renderSetup() {
    $('#f-name').value = regatta.name || '';
    $('#f-organizer').value = regatta.organizer || '';
    $('#f-venue').value = regatta.venue || '';
    $('#f-start').value = regatta.startDate || '';
    $('#f-end').value = regatta.endDate || '';
    $('#f-system').value = regatta.scoringSystem || 'low-point';
    renderDiscardRows();
    renderFleetChips();
  }

  function renderDiscardRows() {
    const tb = $('#discardRows');
    tb.innerHTML = '';
    regatta.discardSchedule.forEach(function (rule, i) {
      const tr = el('tr', {}, [
        el('td', {}, [el('input', {
          type: 'number', min: '0', value: rule.races,
          onchange: function (e) { rule.races = Math.max(0, parseInt(e.target.value, 10) || 0); persist(); }
        })]),
        el('td', {}, [el('input', {
          type: 'number', min: '0', value: rule.discards,
          onchange: function (e) { rule.discards = Math.max(0, parseInt(e.target.value, 10) || 0); persist(); }
        })]),
        el('td', {}, [el('button', {
          type: 'button', class: 'icon-btn', title: 'Remove rule',
          onclick: function () {
            regatta.discardSchedule.splice(i, 1);
            if (!regatta.discardSchedule.length) regatta.discardSchedule.push({ races: 0, discards: 0 });
            persist(); renderDiscardRows();
          }
        }, ['✕'])]),
      ]);
      tb.appendChild(tr);
    });
  }

  function renderFleetChips() {
    const wrap = $('#fleetChips');
    wrap.innerHTML = '';
    if (!regatta.fleets.length) {
      wrap.appendChild(el('span', { class: 'muted' }, ['No fleets — all boats scored together.']));
    }
    regatta.fleets.forEach(function (f) {
      wrap.appendChild(el('span', { class: 'chip' }, [
        f.name,
        el('button', {
          type: 'button', class: 'chip-x', title: 'Remove fleet',
          onclick: function () { removeFleet(f.id); }
        }, ['✕'])
      ]));
    });
  }

  function removeFleet(id) {
    const used = regatta.boats.some(function (b) { return b.fleetId === id; });
    if (used && !confirm('Boats are assigned to this fleet. Remove it anyway? Those boats will become unassigned.')) return;
    regatta.fleets = regatta.fleets.filter(function (f) { return f.id !== id; });
    regatta.boats.forEach(function (b) { if (b.fleetId === id) b.fleetId = ''; });
    regatta.races.forEach(function (r) { if (r.fleetId === id) r.fleetId = 'all'; });
    persist(); renderFleetChips();
  }

  function initSetupHandlers() {
    $('#setupForm').addEventListener('submit', function (e) {
      e.preventDefault();
      regatta.name = $('#f-name').value.trim();
      regatta.organizer = $('#f-organizer').value.trim();
      regatta.venue = $('#f-venue').value.trim();
      regatta.startDate = $('#f-start').value;
      regatta.endDate = $('#f-end').value;
      regatta.scoringSystem = $('#f-system').value;
      persist();
      const note = $('#setupSaved');
      note.textContent = 'Saved ✓';
      setTimeout(function () { note.textContent = ''; }, 1800);
      toast('Setup saved');
    });

    $('#btnAddDiscard').addEventListener('click', function () {
      const last = regatta.discardSchedule[regatta.discardSchedule.length - 1] || { races: 0, discards: 0 };
      regatta.discardSchedule.push({ races: (Number(last.races) || 0) + 1, discards: (Number(last.discards) || 0) + 1 });
      persist(); renderDiscardRows();
    });

    function addFleet() {
      const input = $('#f-fleet-new');
      const name = input.value.trim();
      if (!name) return;
      regatta.fleets.push({ id: DB.uid('flt'), name: name });
      input.value = '';
      persist(); renderFleetChips();
    }
    $('#btnAddFleet').addEventListener('click', addFleet);
    $('#f-fleet-new').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); addFleet(); }
    });
  }

  // =====================================================================
  // BOATS VIEW
  // =====================================================================
  function renderBoats() {
    // fleet select in the add form
    const sel = $('#b-fleet');
    sel.innerHTML = '';
    if (regatta.fleets.length) {
      regatta.fleets.forEach(function (f) { sel.appendChild(el('option', { value: f.id }, [f.name])); });
    } else {
      sel.appendChild(el('option', { value: '' }, ['(no fleets)']));
      sel.disabled = true;
    }
    if (regatta.fleets.length) sel.disabled = false;

    const tb = $('#boatRows');
    tb.innerHTML = '';
    regatta.boats.forEach(function (b) {
      tb.appendChild(el('tr', {}, [
        cellEditable(b, 'sail'),
        cellEditable(b, 'name'),
        cellEditable(b, 'skipper'),
        cellEditable(b, 'boatClass'),
        el('td', {}, [fleetSelectFor(b)]),
        cellEditable(b, 'rating'),
        el('td', {}, [el('button', {
          class: 'icon-btn danger', title: 'Remove boat',
          onclick: function () { removeBoat(b.id); }
        }, ['✕'])]),
      ]));
    });
    $('#boatEmpty').hidden = regatta.boats.length > 0;
    $('#boatCount').textContent = regatta.boats.length + (regatta.boats.length === 1 ? ' boat' : ' boats');
  }

  function cellEditable(boat, field) {
    return el('td', {}, [el('input', {
      type: 'text', value: esc(boat[field]), class: 'cell-input',
      onchange: function (e) { boat[field] = e.target.value; persist(); }
    })]);
  }

  function fleetSelectFor(boat) {
    if (!regatta.fleets.length) return el('span', { class: 'muted' }, ['—']);
    const sel = el('select', {
      class: 'cell-input',
      onchange: function (e) { boat.fleetId = e.target.value; persist(); }
    }, fleetOptions(false, boat.fleetId));
    return sel;
  }

  function removeBoat(id) {
    const used = regatta.races.some(function (r) {
      return (r.results || []).some(function (res) { return res.boatId === id; });
    });
    if (used && !confirm('This boat has race results. Remove it and its results?')) return;
    regatta.boats = regatta.boats.filter(function (b) { return b.id !== id; });
    regatta.races.forEach(function (r) {
      r.results = (r.results || []).filter(function (res) { return res.boatId !== id; });
    });
    persist(); renderBoats();
  }

  function initBoatHandlers() {
    $('#boatForm').addEventListener('submit', function (e) {
      e.preventDefault();
      const sail = $('#b-sail').value.trim();
      const name = $('#b-name').value.trim();
      if (!sail && !name) { toast('Enter at least a sail number or boat name'); return; }
      regatta.boats.push({
        id: DB.uid('boat'),
        sail: sail,
        name: name,
        skipper: $('#b-skipper').value.trim(),
        boatClass: $('#b-class').value.trim(),
        fleetId: regatta.fleets.length ? ($('#b-fleet').value || regatta.fleets[0].id) : '',
        rating: $('#b-rating').value.trim(),
      });
      persist();
      ['#b-sail', '#b-name', '#b-skipper', '#b-class', '#b-rating'].forEach(function (s) { $(s).value = ''; });
      $('#b-sail').focus();
      renderBoats();
    });
  }

  // =====================================================================
  // RACES VIEW
  // =====================================================================
  function renderRaces() {
    $('#raceDetailPane').hidden = currentRaceId == null;
    $('#raceListPane').hidden = currentRaceId != null;
    if (currentRaceId != null) { renderRaceDetail(); return; }

    const list = $('#raceList');
    list.innerHTML = '';
    const sorted = regatta.races.slice();
    sorted.forEach(function (r) {
      const finishers = (r.results || []).filter(function (x) { return x.code === 'FIN' || (!x.code && x.position != null); }).length;
      const entered = (r.results || []).length;
      list.appendChild(el('div', { class: 'race-card', onclick: function () { openRace(r.id); } }, [
        el('div', { class: 'race-card-main' }, [
          el('div', { class: 'race-card-title' }, [r.name || ('Race ' + r.number)]),
          el('div', { class: 'race-card-sub' }, [
            fleetName(r.fleetId),
            el('span', { class: 'dot' }, ['·']),
            finishers + ' finishers',
            r.completed ? el('span', { class: 'badge ok' }, ['scored']) : el('span', { class: 'badge' }, ['open']),
          ]),
        ]),
        el('div', { class: 'race-card-go' }, ['›']),
      ]));
    });
    $('#raceEmpty').hidden = regatta.races.length > 0;
  }

  function nextRaceNumber(fleetId) {
    const nums = regatta.races
      .filter(function (r) { return (r.fleetId || 'all') === (fleetId || 'all'); })
      .map(function (r) { return Number(r.number) || 0; });
    return (nums.length ? Math.max.apply(null, nums) : 0) + 1;
  }

  function addRace() {
    if (!regatta.boats.length) { toast('Add some boats first'); return; }
    const fleetId = regatta.fleets.length ? regatta.fleets[0].id : 'all';
    const num = nextRaceNumber(fleetId);
    const r = {
      id: DB.uid('race'), number: num, name: 'Race ' + num, date: '',
      fleetId: fleetId, completed: false, results: [],
    };
    regatta.races.push(r);
    persist();
    openRace(r.id);
  }

  function openRace(id) { currentRaceId = id; renderRaces(); }
  function closeRace() { currentRaceId = null; renderRaces(); }

  function getRace() { return regatta.races.find(function (r) { return r.id === currentRaceId; }); }

  // Boats eligible for the open race (its fleet).
  function raceBoats(race) {
    if (!race.fleetId || race.fleetId === 'all') return regatta.boats.slice();
    return regatta.boats.filter(function (b) { return b.fleetId === race.fleetId; });
  }

  function resultFor(race, boatId) {
    return (race.results || []).find(function (r) { return r.boatId === boatId; });
  }

  function renderRaceDetail() {
    const race = getRace();
    if (!race) { closeRace(); return; }

    $('#raceTitle').textContent = (race.name || ('Race ' + race.number));

    // fleet filter / assignment for the race
    const ff = $('#raceFleetFilter');
    ff.innerHTML = '';
    fleetOptions(true, race.fleetId).forEach(function (o) { ff.appendChild(o); });
    ff.onchange = function (e) {
      race.fleetId = e.target.value;
      // drop results for boats no longer in this fleet
      const allowed = {};
      raceBoats(race).forEach(function (b) { allowed[b.id] = true; });
      race.results = (race.results || []).filter(function (r) { return allowed[r.boatId]; });
      renumberFinishers(race);
      persist(); renderRaceDetail();
    };

    const boats = raceBoats(race);
    const entries = boats.length;

    // ----- On the water pool (not yet entered) -----
    const pool = $('#waterPool');
    pool.innerHTML = '';
    const notEntered = boats.filter(function (b) { return !resultFor(race, b.id); });
    notEntered.forEach(function (b) {
      pool.appendChild(el('button', {
        class: 'pool-boat', onclick: function () { addFinisher(race, b.id); }
      }, [
        el('span', { class: 'pb-sail' }, [esc(b.sail) || '—']),
        el('span', { class: 'pb-name' }, [esc(b.name) || esc(b.skipper) || '(boat)']),
        el('span', { class: 'pb-add' }, ['Finish ✓']),
      ]));
    });
    if (!notEntered.length) pool.appendChild(el('p', { class: 'muted small' }, ['All boats entered.']));
    $('#waterCount').textContent = '(' + notEntered.length + ')';

    // ----- Finish order list -----
    const finishers = (race.results || [])
      .filter(function (r) { return r.code === 'FIN' && r.position != null; })
      .sort(function (a, b) { return a.position - b.position; });
    const fl = $('#finishList');
    fl.innerHTML = '';
    finishers.forEach(function (r) {
      const b = boats.find(function (x) { return x.id === r.boatId; });
      if (!b) return;
      fl.appendChild(el('li', { class: 'finish-item' }, [
        el('span', { class: 'fi-pos' }, [String(r.position)]),
        el('span', { class: 'fi-boat' }, [
          el('strong', {}, [esc(b.sail) || '—']),
          ' ', el('span', { class: 'muted' }, [esc(b.name) || esc(b.skipper) || '']),
        ]),
        el('span', { class: 'fi-ctrls' }, [
          el('button', { class: 'icon-btn', title: 'Move up', onclick: function () { moveFinisher(race, r.boatId, -1); } }, ['↑']),
          el('button', { class: 'icon-btn', title: 'Move down', onclick: function () { moveFinisher(race, r.boatId, 1); } }, ['↓']),
          codeMenu(race, b, r),
          el('button', { class: 'icon-btn danger', title: 'Remove from finish', onclick: function () { clearResult(race, r.boatId); } }, ['✕']),
        ]),
      ]));
    });
    if (!finishers.length) fl.appendChild(el('li', { class: 'muted small no-bullet' }, ['No finishers yet — tap a boat at left as it crosses the line.']));
    $('#finishCount').textContent = '(' + finishers.length + ')';

    // ----- Penalties / codes list -----
    const penalized = (race.results || []).filter(function (r) { return r.code && r.code !== 'FIN'; });
    const pl = $('#penList');
    pl.innerHTML = '';
    penalized.forEach(function (r) {
      const b = boats.find(function (x) { return x.id === r.boatId; });
      if (!b) return;
      const cinfo = S.CODES[r.code] || { label: r.code };
      pl.appendChild(el('div', { class: 'pen-item' }, [
        el('span', { class: 'code-chip' }, [cinfo.label]),
        el('span', { class: 'pi-boat' }, [
          el('strong', {}, [esc(b.sail) || '—']), ' ',
          el('span', { class: 'muted' }, [esc(b.name) || esc(b.skipper) || '']),
        ]),
        r.code === 'RDG'
          ? el('span', { class: 'rdg-pts' }, ['pts ', el('input', {
              type: 'number', step: 'any', min: '0', value: r.points != null ? r.points : (entries + 1),
              onchange: function (e) { r.points = parseFloat(e.target.value); persist(); renderRaceDetail(); }
            })])
          : el('span', { class: 'pi-pts muted' }, [String(entries + 1) + ' pts']),
        el('span', { class: 'pi-ctrls' }, [
          codeMenu(race, b, r),
          el('button', { class: 'icon-btn danger', title: 'Remove', onclick: function () { clearResult(race, r.boatId); } }, ['✕']),
        ]),
      ]));
    });
    if (!penalized.length) pl.appendChild(el('p', { class: 'muted small' }, ['No penalty codes entered.']));
    $('#penCount').textContent = '(' + penalized.length + ')';

    // race completed toggle lives on the back-bar; reflect status via title badge
  }

  // Dropdown to assign / change a scoring code for a boat.
  function codeMenu(race, boat, result) {
    const sel = el('select', {
      class: 'code-select', title: 'Set scoring code',
      onchange: function (e) {
        const code = e.target.value;
        setCode(race, boat.id, code);
      }
    });
    sel.appendChild(el('option', { value: 'FIN', selected: result.code === 'FIN' ? 'selected' : false }, ['Finished']));
    S.CODE_ORDER.forEach(function (code) {
      sel.appendChild(el('option', { value: code, selected: result.code === code ? 'selected' : false }, [S.CODES[code].label]));
    });
    return sel;
  }

  // ---- race mutations ----
  function addFinisher(race, boatId) {
    if (resultFor(race, boatId)) return;
    const maxPos = (race.results || []).reduce(function (m, r) {
      return (r.code === 'FIN' && r.position != null) ? Math.max(m, r.position) : m;
    }, 0);
    race.results.push({ boatId: boatId, code: 'FIN', position: maxPos + 1 });
    persist(); renderRaceDetail();
  }

  function setCode(race, boatId, code) {
    let r = resultFor(race, boatId);
    if (!r) { r = { boatId: boatId }; race.results.push(r); }
    if (code === 'FIN') {
      const maxPos = race.results.reduce(function (m, x) {
        return (x.code === 'FIN' && x.position != null) ? Math.max(m, x.position) : m;
      }, 0);
      r.code = 'FIN';
      r.position = maxPos + 1;
      delete r.points;
    } else {
      r.code = code;
      r.position = null;
      if (code === 'RDG' && r.points == null) r.points = raceBoats(race).length + 1;
      if (code !== 'RDG') delete r.points;
    }
    renumberFinishers(race);
    persist(); renderRaceDetail();
  }

  function clearResult(race, boatId) {
    race.results = (race.results || []).filter(function (r) { return r.boatId !== boatId; });
    renumberFinishers(race);
    persist(); renderRaceDetail();
  }

  // Re-pack finishing positions to 1..n in current order (no gaps).
  function renumberFinishers(race) {
    const fin = (race.results || [])
      .filter(function (r) { return r.code === 'FIN' && r.position != null; })
      .sort(function (a, b) { return a.position - b.position; });
    fin.forEach(function (r, i) { r.position = i + 1; });
  }

  function moveFinisher(race, boatId, dir) {
    const fin = (race.results || [])
      .filter(function (r) { return r.code === 'FIN' && r.position != null; })
      .sort(function (a, b) { return a.position - b.position; });
    const idx = fin.findIndex(function (r) { return r.boatId === boatId; });
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= fin.length) return;
    const tmp = fin[idx].position;
    fin[idx].position = fin[swap].position;
    fin[swap].position = tmp;
    persist(); renderRaceDetail();
  }

  function undoLastFinish(race) {
    const fin = (race.results || [])
      .filter(function (r) { return r.code === 'FIN' && r.position != null; })
      .sort(function (a, b) { return a.position - b.position; });
    if (!fin.length) return;
    const last = fin[fin.length - 1];
    clearResult(race, last.boatId);
  }

  function markRemainingDNC(race) {
    const boats = raceBoats(race);
    boats.forEach(function (b) {
      if (!resultFor(race, b.id)) race.results.push({ boatId: b.id, code: 'DNC', position: null });
    });
    race.completed = true;
    persist(); renderRaceDetail();
    toast('Remaining boats scored DNC; race marked scored');
  }

  function clearRace(race) {
    if (!confirm('Clear all entries for this race?')) return;
    race.results = [];
    race.completed = false;
    persist(); renderRaceDetail();
  }

  function initRaceHandlers() {
    $('#btnAddRace').addEventListener('click', addRace);
    $('#btnBackRaces').addEventListener('click', closeRace);
    $('#btnUndoFinish').addEventListener('click', function () { const r = getRace(); if (r) undoLastFinish(r); });
    $('#btnMarkDNC').addEventListener('click', function () { const r = getRace(); if (r) markRemainingDNC(r); });
    $('#btnClearRace').addEventListener('click', function () { const r = getRace(); if (r) clearRace(r); });
    $('#btnDeleteRace').addEventListener('click', function () {
      const r = getRace();
      if (!r) return;
      if (!confirm('Delete this race and its results?')) return;
      regatta.races = regatta.races.filter(function (x) { return x.id !== r.id; });
      persist(); closeRace();
    });
  }

  // =====================================================================
  // RESULTS VIEW
  // =====================================================================
  function resultsFleetList() {
    if (regatta.fleets.length) return regatta.fleets.map(function (f) { return f.id; });
    return ['all'];
  }

  function renderResults() {
    const sel = $('#resultsFleetSelect');
    const fleets = resultsFleetList();
    // (re)build the selector
    const prev = sel.value;
    sel.innerHTML = '';
    fleets.forEach(function (fid) {
      sel.appendChild(el('option', { value: fid, selected: fid === prev ? 'selected' : false }, [fleetName(fid)]));
    });
    sel.onchange = function () { renderResultsTable(sel.value); };

    $('#resultsTitle').textContent = (regatta.name || 'Results');
    const bits = [];
    if (regatta.venue) bits.push(regatta.venue);
    if (regatta.startDate) bits.push(formatDateRange(regatta.startDate, regatta.endDate));
    $('#resultsSub').textContent = bits.join(' · ');

    const fid = fleets.indexOf(prev) >= 0 ? prev : fleets[0];
    sel.value = fid;
    renderResultsTable(fid);
  }

  function renderResultsTable(fleetId) {
    const data = S.scoreFleet(regatta, fleetId);
    const wrap = $('#resultsWrap');
    wrap.innerHTML = '';

    if (!data.rows.length) {
      wrap.appendChild(el('p', { class: 'empty-note' }, ['No boats in this fleet yet.']));
      $('#resultsLegend').textContent = '';
      return;
    }

    const table = el('table', { class: 'data-table results-table' });
    const thead = el('thead');
    const hr = el('tr', {}, [
      el('th', { class: 'col-rank' }, ['Pos']),
      el('th', { class: 'col-sail' }, ['Sail #']),
      el('th', {}, ['Boat']),
      el('th', {}, ['Skipper']),
    ]);
    data.races.forEach(function (r) {
      hr.appendChild(el('th', { class: 'col-race', title: r.name || ('Race ' + r.number) }, ['R' + r.number]));
    });
    hr.appendChild(el('th', { class: 'col-total' }, ['Total']));
    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = el('tbody');
    data.rows.forEach(function (row) {
      const tr = el('tr', {});
      tr.appendChild(el('td', { class: 'col-rank' }, [
        String(row.rank), row.tiedRank ? el('span', { class: 'tie-mark', title: 'Tie could not be broken' }, ['T']) : null
      ]));
      tr.appendChild(el('td', { class: 'col-sail' }, [esc(row.boat.sail) || '—']));
      tr.appendChild(el('td', {}, [esc(row.boat.name) || '']));
      tr.appendChild(el('td', {}, [esc(row.boat.skipper) || '']));
      row.cells.forEach(function (c) {
        const display = c.finisher ? formatPlace(c) : (S.CODES[c.code] ? S.CODES[c.code].label : c.code);
        const ptsText = c.finisher ? '' : '';
        const td = el('td', { class: 'col-race' + (c.excluded ? ' excluded' : '') }, [
          el('span', { class: 'cell-score' }, [display]),
          c.finisher ? null : el('span', { class: 'cell-pts' }, [' (' + fmtNum(c.points) + ')']),
        ]);
        if (c.excluded) td.title = 'Discarded (worst score)';
        tr.appendChild(td);
      });
      tr.appendChild(el('td', { class: 'col-total' }, [fmtNum(row.total)]));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);

    // Summary + legend
    const summary = [
      data.entries + ' entered',
      data.completedRaces + ' race' + (data.completedRaces === 1 ? '' : 's'),
      'discards allowed: ' + data.discardsAllowed,
      'penalty score: ' + (data.entries + 1) + ' pts',
    ].join(' · ');
    $('#resultsLegend').innerHTML =
      '<strong>' + summary + '</strong><br>' +
      'Scored under RRS Appendix A Low Point System. ' +
      'Bracketed numbers are points; <span class="excluded-legend">struck-through</span> scores are discards (A2). ' +
      'Ties broken per A8.1 then A8.2. Codes: ' +
      S.CODE_ORDER.map(function (c) { return S.CODES[c].label; }).join(', ') + '.';
  }

  function formatPlace(cell) {
    // Finisher: show finishing place; show .5 for dead-heat ties.
    if (cell.tied) return fmtNum(cell.points);
    return String(cell.place);
  }
  function fmtNum(n) {
    if (n == null) return '';
    return (Math.round(n * 100) / 100).toString();
  }

  // =====================================================================
  // CSV EXPORT
  // =====================================================================
  function resultsCSV(fleetId) {
    const data = S.scoreFleet(regatta, fleetId);
    const rows = [];
    const header = ['Pos', 'Sail', 'Boat', 'Skipper'];
    data.races.forEach(function (r) { header.push('R' + r.number); });
    header.push('Total');
    rows.push(header);
    data.rows.forEach(function (row) {
      const line = [
        row.rank + (row.tiedRank ? 'T' : ''),
        row.boat.sail || '',
        row.boat.name || '',
        row.boat.skipper || '',
      ];
      row.cells.forEach(function (c) {
        let v = c.finisher ? formatPlace(c) : (S.CODES[c.code] ? S.CODES[c.code].label : c.code);
        v += ' (' + fmtNum(c.points) + ')';
        if (c.excluded) v = '[' + v + ']';
        line.push(v);
      });
      line.push(fmtNum(row.total));
      rows.push(line);
    });
    return rows.map(function (r) {
      return r.map(function (cell) {
        const s = String(cell == null ? '' : cell);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\n');
  }

  function downloadCSV() {
    const fid = $('#resultsFleetSelect').value;
    const csv = resultsCSV(fid);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safe = (regatta.name || 'regatta').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    a.href = url;
    a.download = safe + '-' + fleetName(fid).replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-results.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // =====================================================================
  // UTIL
  // =====================================================================
  function formatDateRange(start, end) {
    if (!start) return '';
    if (!end || end === start) return start;
    return start + ' – ' + end;
  }

  // =====================================================================
  // TOP-LEVEL ACTIONS
  // =====================================================================
  function startNewRegatta() {
    regatta = DB.emptyRegatta();
    persist();
    showView('setup');
  }

  function loadSample() {
    regatta = DB.sampleRegatta();
    persist();
    showView('results');
    toast('Sample regatta loaded');
  }

  function initTopHandlers() {
    $('#btnCreate').addEventListener('click', startNewRegatta);
    $('#btnSample').addEventListener('click', loadSample);

    $$('.nav-btn').forEach(function (b) {
      b.addEventListener('click', function () { showView(b.dataset.view); });
    });

    $('#btnExport').addEventListener('click', function () {
      if (!regatta) { toast('Nothing to export yet'); return; }
      DB.exportFile(regatta);
    });
    $('#btnImport').addEventListener('click', function () { $('#importFile').click(); });
    $('#importFile').addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (!file) return;
      DB.importFile(file).then(function (data) {
        regatta = data;
        persist();
        currentRaceId = null;
        showView('results');
        toast('Regatta imported');
      }).catch(function (err) { alert(err.message); });
      e.target.value = '';
    });

    $('#btnNew').addEventListener('click', function () {
      if (regatta && !confirm('Start a new regatta? Your current regatta will be replaced. Export first if you want a backup.')) return;
      startNewRegatta();
    });

    $('#btnCSV').addEventListener('click', downloadCSV);
    $('#btnPrint').addEventListener('click', function () { window.print(); });
  }

  // =====================================================================
  // BOOT
  // =====================================================================
  function boot() {
    initTopHandlers();
    initSetupHandlers();
    initBoatHandlers();
    initRaceHandlers();

    regatta = DB.load();
    if (regatta) {
      $('#topNav').hidden = false;
      showView(regatta.name ? 'results' : 'setup');
    } else {
      showView('welcome');
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
