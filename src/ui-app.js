/* App state, saving, undo, the top bar, menus and keyboard shortcuts. */
(function (root) {
  'use strict';
  const C = root.TMCore, S = root.TMStorage;
  const $ = (sel, el) => (el || document).querySelector(sel);
  const esc = C.esc;

  const CROSS = `<svg class="cross" viewBox="0 0 65 65" aria-hidden="true"><defs><linearGradient id="omdg" gradientUnits="userSpaceOnUse" x1="23.28" y1="35.1" x2="64.98" y2="35.1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#00B570"/></linearGradient></defs><path fill="#3DD79D" d="M32.8,23.3h-9.5l0,30.9c0,6,4.8,10.8,10.8,10.8l10.7,0l0-29.8C44.8,28.6,39.4,23.3,32.8,23.3z"/><path fill="#3DD79D" d="M35.2,41.7l9.5,0l0-30.9C44.8,4.8,39.9,0,34,0L23.3,0v29.8C23.3,36.4,28.6,41.7,35.2,41.7z"/><path fill="#00B570" d="M44.8,29.8V12.2c0,0-2.7,8-9.5,8H10.8C4.8,20.2,0,25.1,0,31l0,10.7h33.2C39.8,41.7,44.8,36.4,44.8,29.8z"/><path fill="url(#omdg)" d="M23.3,32.1V50c0,0,1.4-8.1,8.4-8.3h22.5c6,0,10.8-4.8,10.8-10.8V20.2l-29.8,0C28.6,20.2,23.3,25.6,23.3,32.1z"/></svg>`;

  const app = {
    data: null,
    store: null,
    ui: { tab: 'board', selectedId: null, panelId: null, search: '', colorFilter: null, focus: false, trayOpen: false, weekCursor: null, monthCursor: null, timeWeek: null, noteId: null, noteSearch: '', snooze: {} },
    today: () => C.todayISO(),
    tasks: () => app.data.tasks,
    task: id => app.data.tasks.find(t => t.id === id),
    prefs: () => app.data.prefs,
    actions: {},
    views: {},
  };
  root.TMApp = app;
  app.$ = $;
  app.CROSS = CROSS;
  app.fx = root.TMFx;

  /* ---------- light and dark ---------- */
  const systemDark = root.matchMedia ? root.matchMedia('(prefers-color-scheme: dark)') : null;
  const themeChoice = () => (app.data ? app.prefs().theme : S.getThemeHint()) || 'light';
  function paintTheme() {
    const choice = themeChoice();
    const dark = choice === 'dark' || (choice === 'system' && !!systemDark && systemDark.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }
  app.isDark = () => document.documentElement.dataset.theme === 'dark';
  app.setTheme = choice => {
    app.prefs().theme = choice;
    S.setThemeHint(choice);
    paintTheme();
    app.commit();
  };
  app.actions.toggleTheme = () => app.setTheme(app.isDark() ? 'light' : 'dark');
  if (systemDark && systemDark.addEventListener) systemDark.addEventListener('change', paintTheme);
  paintTheme();

  /* ---------- saving ---------- */
  let saveTimer = null, saving = false, dirty = false, blocked = false;

  function setSaveState(state, text) {
    const el = $('#saveState');
    if (el) { el.className = 'save ' + state; el.textContent = text; }
  }
  app.scheduleSave = function () {
    app.lastActiveAt = new Date().toISOString();
    dirty = true;
    if (blocked) return;
    setSaveState('busy', 'Saving…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 400);
  };
  async function flush(opts) {
    if (!app.store || saving) { if (saving) saveTimer = setTimeout(flush, 200); return; }
    saving = true;
    dirty = false;
    try {
      await app.store.save(C.serialize(app.data), opts);
      setSaveState('ok', 'Saved');
      hideBanner('save');
    } catch (e) {
      dirty = true;
      if (e instanceof S.ConflictError) {
        blocked = true;
        setSaveState('bad', 'Not saved');
        showBanner('save', `Your saved data was changed outside this window, so nothing was overwritten. Your latest changes are still on this screen.`, [
          ['Download my version', () => app.exportData()],
          ['Load the saved version', () => location.reload()],
          ['Save mine over it', () => { blocked = false; flush({ force: true }); }],
        ]);
      } else {
        setSaveState('bad', 'Not saved');
        showBanner('save', `Your changes could not be saved (${esc(e.message || 'unknown problem')}). They are still on this screen, but will be lost if you close it.`, [
          ['Try again', () => flush()],
          ['Download a copy', () => app.exportData()],
        ]);
      }
    } finally {
      saving = false;
    }
  }
  app.flush = flush;
  app.isDirty = () => dirty;
  app.setStore = store => { app.store = store; };

  /* ---------- banners, toasts, modals ---------- */
  const bannerActions = {};
  function showBanner(key, html, actions) {
    const host = $('#banners');
    if (!host) return;
    let el = host.querySelector(`[data-banner="${key}"]`);
    if (!el) { el = document.createElement('div'); el.className = 'banner'; el.dataset.banner = key; host.appendChild(el); }
    bannerActions[key] = actions || [];
    el.innerHTML = `<span>${html}</span><span class="banner-acts">${(actions || []).map((a, i) => `<button class="btn small" data-act="bannerAct" data-key="${key}" data-i="${i}">${esc(a[0])}</button>`).join('')}</span>`;
  }
  function hideBanner(key) {
    const el = $(`#banners [data-banner="${key}"]`);
    if (el) el.remove();
  }
  app.showBanner = showBanner;
  app.hideBanner = hideBanner;
  app.actions.bannerAct = el => { const a = bannerActions[el.dataset.key][Number(el.dataset.i)]; if (a) a[1](); };

  let toastTimer = null;
  app.toast = function (text, opts) {
    const host = $('#toast');
    if (!host) return;
    host.innerHTML = `<span>${esc(text)}</span>${opts && opts.undo ? '<button class="linkbtn" data-act="undo">Undo</button>' : ''}`;
    host.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => host.classList.remove('show'), (opts && opts.ms) || 5000);
  };
  app.openModal = function (html, cls) {
    $('#modalRoot').innerHTML = `<div class="scrim" data-act="closeModalScrim"><div class="modal ${cls || ''}" role="dialog" aria-modal="true">${html}</div></div>`;
    const first = $('#modalRoot input, #modalRoot textarea');
    if (first) first.focus();
  };
  app.closeModal = () => { $('#modalRoot').innerHTML = ''; };
  app.modalOpen = () => !!$('#modalRoot .scrim');
  app.actions.closeModal = () => app.closeModal();
  app.actions.closeModalScrim = (el, ev) => { if (ev.target === el) app.closeModal(); };
  app.message = (title, body) => app.openModal(`<h2>${esc(title)}</h2><p>${esc(body)}</p><div class="modal-acts"><button class="btn primary" data-act="closeModal">OK</button></div>`);

  /* ---------- undo ---------- */
  const undoStack = [];
  const snapshot = label => JSON.stringify({ label, tasks: app.data.tasks, notes: app.data.notes, templates: app.data.templates, areas: app.data.areas, clients: app.data.clients });
  app.remember = function (label) {
    undoStack.push(snapshot(label));
    if (undoStack.length > 40) undoStack.shift();
  };
  /* Runs a change that can be undone, then redraws and saves. */
  app.change = function (label, fn, opts) {
    app.remember(label);
    fn();
    app.commit();
    if (opts && opts.toast) app.toast(opts.toast, { undo: true });
  };
  app.commit = function () { app.render(); app.scheduleSave(); };
  app.actions.undo = function () {
    const raw = undoStack.pop();
    if (!raw) { app.toast('Nothing to undo', { ms: 2000 }); return; }
    const s = JSON.parse(raw);
    app.data.tasks = s.tasks; app.data.notes = s.notes; app.data.templates = s.templates; app.data.areas = s.areas || []; if (s.clients) app.data.clients = s.clients;
    if (app.ui.panelId && !app.task(app.ui.panelId)) app.ui.panelId = null;
    app.commit();
    app.toast(`Undid: ${s.label}`, { ms: 3000 });
  };

  /* ---------- timers ---------- */
  app.toggleTimer = function (id) {
    const t = app.task(id);
    if (!t) return;
    const now = new Date();
    const wasRunning = !!t.timerStartedAt;
    for (const other of app.tasks()) if (other.timerStartedAt) C.pauseTimer(other, now);
    if (!wasRunning && !C.isDone(t)) t.timerStartedAt = now.toISOString();
    t.updatedAt = now.toISOString();
    app.commit();
    app.fx.sound(wasRunning ? 'pause' : 'start');
  };
  app.actions.timer = el => app.toggleTimer(el.dataset.id);
  app.runningTask = () => app.tasks().find(t => t.timerStartedAt);

  /* Lets someone stop a forgotten timer at the time they really stopped working. */
  let stopping = null;
  function whenLabel(iso) {
    const d = new Date(iso);
    return `${C.fmtDay(C.todayISO(d))}, ${C.localDateTimeValue(d).slice(11)}`;
  }
  function stopPreview() {
    const out = $('#stopPreview'), input = $('#stopAt'), t = app.task(stopping);
    if (!out || !input || !t) return;
    const end = new Date(input.value).getTime(), start = Date.parse(t.timerStartedAt);
    out.classList.remove('warn');
    if (!input.value || Number.isNaN(end)) { out.textContent = 'Choose a date and time.'; out.classList.add('warn'); return; }
    if (end <= start) { out.textContent = `Choose a time after the timer started (${whenLabel(t.timerStartedAt)}).`; out.classList.add('warn'); return; }
    if (end > Date.now() + 60000) { out.textContent = 'That time is still in the future.'; out.classList.add('warn'); return; }
    const secs = Math.floor((end - start) / 1000);
    out.innerHTML = `This session will count as <b>${esc(C.formatDuration(secs))}</b> (${esc(C.formatHours(secs))} h).`;
  }
  app.askStopTime = function (id, lastActive, opts) {
    const t = app.task(id);
    if (!t || !t.timerStartedAt) return;
    const now = new Date();
    stopping = id;
    const guess = C.timerStopGuess(t, lastActive || app.lastActiveAt, now);
    app.openModal(`<h2>${opts && opts.reopening ? 'Is this timer <em>still running?</em>' : 'When did you <em>stop?</em>'}</h2>
      <p>The timer on <b>${esc(t.title)}</b> has been running since ${esc(whenLabel(t.timerStartedAt))}.</p>
      <form data-form="stopAt"><label class="field"><span>I stopped working at</span><input id="stopAt" type="datetime-local" value="${C.localDateTimeValue(guess)}" max="${C.localDateTimeValue(now)}"></label>
      <p class="small" id="stopPreview" role="status"></p>
      <div class="modal-acts wrap"><button type="button" class="btn" data-act="keepTimer">Keep it running</button><button class="btn primary">Stop at this time</button></div></form>`);
    stopPreview();
  };
  document.addEventListener('input', ev => { if (ev.target.id === 'stopAt') stopPreview(); });
  app.actions.keepTimer = () => {
    const t = app.task(stopping);
    if (t && t.timerStartedAt) app.ui.snooze[t.timerStartedAt] = C.runningSeconds(t, new Date()) + 4 * 3600;
    hideBanner('long');
    app.closeModal();
  };
  app.actions.stopEarlier = el => app.askStopTime(el.dataset.id);

  /* A due time can pass while the app sits open, so labels catch up each minute without redrawing anything. */
  let lastMinute = -1;
  function refreshDueTimes(now) {
    if (now.getMinutes() === lastMinute) return;
    lastMinute = now.getMinutes();
    let changed = false;
    document.querySelectorAll('[data-due]').forEach(el => {
      const t = app.task(el.dataset.due);
      if (!t || !t.dueTime) return;
      const label = C.dueLabel(t, app.today(), now), cls = `due ${label.kind}`;
      if (el.className !== cls || el.textContent !== label.text) { el.className = cls; el.textContent = label.text; changed = true; }
    });
    if (changed && app.refreshStatLine) app.refreshStatLine();
  }
  function tick() {
    const now = new Date();
    document.querySelectorAll('[data-time]').forEach(el => {
      const t = app.task(el.dataset.time);
      if (t) el.textContent = C.formatDuration(C.taskSeconds(t, now));
    });
    document.querySelectorAll('[data-hours]').forEach(el => {
      const t = app.task(el.dataset.hours);
      if (t) el.textContent = C.hoursLabel(C.taskSeconds(t, now));
    });
    refreshDueTimes(now);
    const run = app.runningTask();
    const clock = $('#runClock');
    if (run && clock) clock.textContent = C.formatClock(C.runningSeconds(run, now));
    if (run) {
      const secs = C.runningSeconds(run, now);
      const after = app.ui.snooze[run.timerStartedAt] || 4 * 3600;
      if (secs >= after) {
        showBanner('long', `Still working on <b>${esc(run.title)}</b>? This timer has been running for ${C.formatDuration(secs)}.`, [
          ['Keep going', () => { app.ui.snooze[run.timerStartedAt] = secs + 4 * 3600; hideBanner('long'); }],
          ['I stopped earlier', () => app.askStopTime(run.id)],
          ['Stop now', () => { hideBanner('long'); app.toggleTimer(run.id); }],
        ]);
      }
    } else hideBanner('long');
  }

  /* ---------- tasks ---------- */
  app.setDone = function (t, done) {
    const now = new Date();
    if (done) {
      C.pauseTimer(t, now);
      t.status = 'done';
      t.completedAt = now.toISOString();
      t.tucked = true;
      if (t.recurrence !== 'none' && !t.recurrenceSpawned) {
        t.recurrenceSpawned = true;
        app.data.tasks.push(C.spawnRecurring(t, app.today()));
      }
    } else {
      t.status = 'progress';
      t.completedAt = null;
      t.tucked = false;
    }
    t.updatedAt = now.toISOString();
  };
  /* Finds a task's note, row or card in whichever view is showing. */
  app.taskEl = id => {
    const key = CSS.escape(id);
    const found = document.querySelectorAll(`#view [data-note="${key}"], #view [data-taskel="${key}"]`);
    return [...found].find(n => n.offsetWidth) || null;
  };
  const noteColor = t => (t.color === 'white' ? null : C.COLORS[t.color]);
  /* Marks a task done with its celebration: particles, a sound, then a flight into the tray. */
  app.finish = function (t, opts) {
    const el = app.taskEl(t.id);
    const box = el ? el.getBoundingClientRect() : null;
    const lifted = app.fx.lift(el, { stamp: !!(el && el.dataset.note) });
    app.change('Mark as done', () => app.setDone(t, true), { toast: `Done: ${t.title}` });
    app.fx.sound(t.priority === 'high' ? 'completeHigh' : t.priority === 'low' ? 'completeLow' : 'complete');
    const point = opts && opts.at ? opts.at : box && box.width ? [box.left + box.width / 2, box.top + box.height / 2] : null;
    if (point) {
      const size = t.priority === 'high' ? 'huge' : t.priority === 'low' ? 'tiny' : 'big';
      app.fx.burst(point[0], point[1], size, noteColor(t));
      if (t.priority === 'high') setTimeout(() => app.fx.burst(point[0], point[1] - 30, 'big', '#D93A33'), 170);
    }
    if (lifted) app.fx.flyTo(lifted, app.ui.view === 'columns' && $('#doneCol') ? $('#doneCol') : $('#trayBtn'));
  };
  /* Marks several tasks done as one step, so a single undo brings them all back. */
  app.finishMany = function (list, opts) {
    const open = list.filter(t => !C.isDone(t));
    if (!open.length) return;
    if (open.length === 1) { app.finish(open[0], opts); return; }
    const flights = open.slice(0, 12).map(t => {
      const el = app.taskEl(t.id);
      const box = el ? el.getBoundingClientRect() : null;
      return { t, box, lifted: app.fx.lift(el, { stamp: !!(el && el.dataset.note) }) };
    });
    app.change('Mark as done', () => open.forEach(t => app.setDone(t, true)), { toast: `Done: ${open.length} tasks` });
    app.fx.sound(open.some(t => t.priority === 'high') ? 'completeHigh' : 'complete');
    const target = app.ui.view === 'columns' && $('#doneCol') ? $('#doneCol') : $('#trayBtn');
    flights.forEach((f, i) => setTimeout(() => {
      if (f.box && f.box.width) app.fx.burst(f.box.left + f.box.width / 2, f.box.top + f.box.height / 2, 'small', noteColor(f.t));
      if (f.lifted) app.fx.flyTo(f.lifted, target);
    }, i * 70));
  };
  app.reopen = function (t) {
    app.change('Reopen task', () => app.setDone(t, false), { toast: `Reopened: ${t.title}` });
    app.fx.sound('restore');
    const el = app.taskEl(t.id);
    app.fx.popIn(el);
    app.fx.burstAt(el, 'small', noteColor(t));
  };
  /* The small celebration when something new appears. */
  app.announceNew = function (t) {
    app.fx.sound('create');
    const el = app.taskEl(t.id);
    if (!el) return;
    if (el.scrollIntoView && !el.dataset.note) el.scrollIntoView({ block: 'nearest' });
    if (el.dataset.note && app.isOffBoard && app.isOffBoard(el)) app.jumpTo(t.id);
    app.fx.popIn(el);
    app.fx.burstAt(el, t.priority === 'high' ? 'big' : t.priority === 'low' ? 'tiny' : 'small', noteColor(t));
  };
  app.actions.toggleDone = el => {
    const t = app.task(el.dataset.id);
    if (!t) return;
    if (C.isDone(t)) app.reopen(t); else app.finish(t);
  };
  /* Ticking a subtask anywhere it appears. */
  document.addEventListener('change', ev => {
    const id = ev.target.dataset && ev.target.dataset.subtick;
    if (!id) return;
    const t = app.task(ev.target.dataset.task), s = t && t.subtasks.find(x => x.id === id);
    if (!s) return;
    const box = ev.target.getBoundingClientRect();
    s.done = ev.target.checked;
    t.updatedAt = new Date().toISOString();
    const finishedAll = s.done && t.subtasks.every(x => x.done);
    app.commit();
    app.fx.sound(!s.done ? 'untick' : finishedAll ? 'allSubtasks' : 'tick');
    if (s.done) app.fx.burst(box.left + box.width / 2, box.top + box.height / 2, finishedAll ? 'small' : 'tiny');
  });
  app.actions.star = el => {
    const t = app.task(el.dataset.id);
    if (t) { t.star = !t.star; app.commit(); }
  };
  /* The saved client list, for pick lists. */
  app.clientNames = () => app.data.clients.map(c => c.name).sort((a, b) => a.localeCompare(b));
  /* Saves a typed client if it's new, and returns the spelling to use. */
  app.rememberClient = name => C.addClient(app.data.clients, name, app.data.owner.id);
  app.createTask = function (fields) {
    const t = C.newTask({ ownerId: app.data.owner.id, ...fields });
    app.data.tasks.push(t);
    return t;
  };

  /* ---------- rendering the frame ---------- */
  function topBar() {
    const tab = app.ui.tab;
    const run = app.runningTask();
    const name = app.data.owner.name || 'Me';
    const saveText = app.isDirty() ? 'Saving…' : 'Saved';
    return `
      <div class="brand">${CROSS}<span>Task<b>master</b></span><small>1.0</small></div>
      <nav class="tabs" aria-label="Sections">
        ${[['board', 'Tasks'], ['notes', 'Notes'], ['time', 'Time'], ['clients', 'Clients']].map(([k, l]) => `<button class="tab ${tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}" ${tab === k ? 'aria-current="page"' : ''}>${l}</button>`).join('')}
      </nav>
      <span class="sp"></span>
      ${run ? `<span class="run"><i></i><button class="linkbtn run-name" data-act="jump" data-id="${esc(run.id)}" title="Show this note">${esc(run.title)}</button><span id="runClock">${C.formatClock(C.runningSeconds(run, new Date()))}</span><button class="run-pause" data-act="timer" data-id="${esc(run.id)}" aria-label="Pause timer" title="Pause timer">❚❚</button></span>` : ''}
      <span id="saveState" class="save ${app.isDirty() ? 'busy' : 'ok'}" title="Saved to ${esc(app.store ? app.store.label : '')}">${saveText}</span>
      <button class="iconbtn theme-btn" data-act="toggleTheme" aria-label="Switch to ${app.isDark() ? 'light' : 'dark'} mode" title="Switch to ${app.isDark() ? 'light' : 'dark'} mode (D)">${app.isDark() ? '☀' : '☾'}</button>
      <button class="who" data-act="personMenu" aria-haspopup="true"><i>${esc(name.trim().charAt(0).toUpperCase() || '?')}</i><span>${esc(name)}</span> ▾</button>
      <button class="btn dark" data-act="quickAdd">+ New task</button>`;
  }
  app.render = function () {
    if (!app.data) return;
    const top = $('#top');
    if (!top) return;
    const hadFailure = $('#saveState') && $('#saveState').classList.contains('bad');
    top.innerHTML = topBar();
    if (hadFailure) setSaveState('bad', 'Not saved');
    const view = app.views[app.ui.tab];
    if (view) view();
    if (app.renderPanel) app.renderPanel();
    if (app.syncPicks) app.syncPicks();
  };
  app.actions.tab = el => {
    app.ui.tab = el.dataset.tab;
    $('#view').innerHTML = '';
    app.render();
  };

  /* ---------- person menu ---------- */
  app.actions.personMenu = (el) => {
    const host = $('#popover');
    if (host.dataset.open === 'person') { app.closePopover(); return; }
    const r = el.getBoundingClientRect();
    const p = app.prefs();
    host.dataset.open = 'person';
    host.style.cssText = `right:${Math.max(8, innerWidth - r.right)}px;top:${r.bottom + 6}px;left:auto;display:block`;
    host.innerHTML = `
      <div class="menu">
        <div class="menu-head"><b>${esc(app.data.owner.name)}</b><small>Saving to ${app.store.mode === 'folder' ? 'folder ' : ''}${esc(app.store.label)}</small></div>
        <button data-act="editName">Change my name</button>
        <button data-act="manageTemplates">Templates</button>
        <button data-act="showShortcuts">Keyboard shortcuts</button>
        <button data-act="cycleTheme">Appearance: ${esc(C.THEMES[p.theme])}</button>
        <button data-act="toggleSound">Sounds: ${p.sound ? 'on' : 'off'}</button>
        <button data-act="toggleEffects">Celebration effects: ${p.effects ? 'on' : 'off'}</button>
        <hr>
        <button data-act="exportData">Export a backup file</button>
        <button data-act="showBackups">Automatic backups</button>
        <button data-act="pickRestore">Restore from a backup file</button>
        <button data-act="pickImport">Import from Taskmaster 0.4</button>
        <button data-act="changeStorage">Change where data is saved</button>
      </div>`;
  };
  app.closePopover = () => { const h = $('#popover'); h.style.display = 'none'; h.innerHTML = ''; delete h.dataset.open; };
  const menu = fn => (el, ev) => { app.closePopover(); fn(el, ev); };

  app.actions.editName = menu(() => app.openModal(`<h2>Your name</h2><form data-form="saveName"><label class="field"><span>Name</span><input id="nameInput" maxlength="60" value="${esc(app.data.owner.name)}"></label><div class="modal-acts"><button type="button" class="btn" data-act="closeModal">Cancel</button><button class="btn primary">Save</button></div></form>`));
  app.forms = {
    saveName: () => {
      const v = $('#nameInput').value.trim();
      if (!v) return;
      app.data.owner.name = v;
      app.closeModal();
      app.commit();
    },
    stopAt: () => {
      const t = app.task(stopping), now = new Date();
      if (!t || !t.timerStartedAt) { app.closeModal(); return; }
      const when = new Date($('#stopAt').value);
      const trial = JSON.parse(JSON.stringify(t)); // try it on a copy, so a bad time changes nothing
      if (!C.stopTimerAt(trial, when, now)) { stopPreview(); return; }
      const counted = trial.timeSessions[trial.timeSessions.length - 1].seconds;
      app.closeModal();
      hideBanner('long');
      app.change('Stop timer', () => {
        C.stopTimerAt(t, when, now);
        t.updatedAt = now.toISOString();
      }, { toast: `Timer stopped. ${C.formatDuration(counted)} (${C.formatHours(counted)} h) counted.` });
      app.fx.sound('pause');
    },
  };
  app.actions.cycleTheme = menu(() => {
    const names = Object.keys(C.THEMES), next = names[(names.indexOf(app.prefs().theme) + 1) % names.length];
    app.setTheme(next);
    app.toast(`Appearance: ${C.THEMES[next]}`, { ms: 2000 });
  });
  app.actions.toggleSound = menu(() => { app.prefs().sound = !app.prefs().sound; app.commit(); app.fx.sound('tick'); app.toast(`Sounds ${app.prefs().sound ? 'on' : 'off'}`, { ms: 2000 }); });
  app.actions.toggleEffects = menu(() => { app.prefs().effects = !app.prefs().effects; app.commit(); app.toast(`Celebration effects ${app.prefs().effects ? 'on' : 'off'}`, { ms: 2000 }); });
  app.actions.showShortcuts = menu(() => showShortcuts());
  function showShortcuts() {
    const rows = [['N', 'New task'], ['/', 'Search'], ['V', 'Switch between sticky notes, list and columns'], ['T', 'Start or pause the timer on the selected note'], ['F', 'Today focus'], ['D', 'Dark or light mode'], ['1  2  3', 'Calendar off, week, month'], ['0', 'Fit all notes on screen'], ['Ctrl + scroll', 'Zoom the board'], ['Space + drag', 'Move around the board'], ['Arrow keys', 'Move the selected note'], ['Alt + up or down', 'Move the selected list row'], ['Shift + arrows', 'Resize the selected note'], ['Shift + click', 'Select several tasks'], ['Shift + drag', 'Select every note in a box on the board'], ['Ctrl + A', 'Select everything showing'], ['Ctrl + Z', 'Undo'], ['Esc', 'Close, or clear the selection'], ['?', 'This list']];
    app.openModal(`<h2>Keyboard shortcuts</h2><dl class="keys">${rows.map(([k, d]) => `<dt><kbd>${esc(k)}</kbd></dt><dd>${esc(d)}</dd>`).join('')}</dl><div class="modal-acts"><button class="btn primary" data-act="closeModal">Close</button></div>`);
  }

  /* ---------- export, backups, restore ---------- */
  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  app.exportData = () => download(`taskmaster-backup-${app.today()}.json`, C.serialize(app.data));
  app.actions.exportData = menu(() => app.exportData());
  let listed = [];
  app.actions.showBackups = menu(async () => {
    await app.flush();
    listed = await app.store.listBackups();
    const when = text => { try { return new Date(JSON.parse(text).savedAt).toLocaleString(); } catch (e) { return 'Earlier version'; } };
    app.openModal(`<h2>Automatic backups</h2><p>Up to five earlier versions are kept ${app.store.mode === 'folder' ? 'in the <b>backups</b> folder next to your data' : 'in this browser'}, at least five minutes apart.</p>
      ${listed.length ? `<div class="rows">${listed.map((t, i) => `<div class="row"><span>${esc(when(t))}</span><button class="btn small" data-act="downloadBackup" data-i="${i}">Download</button><button class="btn small" data-act="restoreListed" data-i="${i}">Restore</button></div>`).join('')}</div>` : '<p class="muted">No backups yet. They start after your next changes.</p>'}
      <div class="modal-acts"><button class="btn primary" data-act="closeModal">Close</button></div>`);
  });
  app.actions.downloadBackup = el => download(`taskmaster-backup-${Number(el.dataset.i) + 1}.json`, listed[Number(el.dataset.i)]);
  app.actions.restoreListed = el => confirmRestore(listed[Number(el.dataset.i)]);

  function pickFile(onText) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const f = input.files[0];
      if (f) onText(await f.text());
    };
    input.click();
  }
  app.pickFile = pickFile;
  app.actions.pickRestore = menu(() => pickFile(confirmRestore));
  let pendingRestore = null;
  function confirmRestore(text) {
    let d;
    try { d = C.parseDataFile(text); }
    catch (e) { app.message('This file cannot be restored', e.message); return; }
    pendingRestore = d;
    app.openModal(`<h2>Replace everything with this backup?</h2><p>It has <b>${d.tasks.length}</b> tasks and <b>${d.notes.length}</b> notes${d.savedAt ? `, saved ${esc(new Date(d.savedAt).toLocaleString())}` : ''}. You can undo this until you close the app.</p><div class="modal-acts"><button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="doRestore">Replace</button></div>`);
  }
  app.actions.doRestore = () => {
    app.change('Restore backup', () => {
      app.data.tasks = pendingRestore.tasks;
      app.data.notes = pendingRestore.notes;
      app.data.templates = pendingRestore.templates;
      app.data.areas = pendingRestore.areas;
      app.data.clients = pendingRestore.clients;
    }, { toast: 'Backup restored' });
    app.ui.panelId = null;
    app.closeModal();
    app.render();
  };

  /* ---------- importing from Taskmaster 0.4 ---------- */
  let pendingImport = null;
  app.previewImport = function (text, onDone) {
    let raw;
    try { raw = JSON.parse(text); } catch (e) { app.message('This file cannot be imported', 'Its contents are damaged, so it could not be read. Nothing was changed.'); return; }
    if (C.detectKind(raw) !== 'v04') { app.message('This file cannot be imported', 'This does not look like Taskmaster 0.4 data. Choose clients.json or a 0.4 backup file. Nothing was changed.'); return; }
    const result = C.migrateV04(raw, { ownerId: app.data.owner.id, ownerName: app.data.owner.name, existingTaskIds: app.tasks().map(t => t.id), existingNoteIds: app.data.notes.map(n => n.id) });
    const s = result.summary;
    pendingImport = { result, onDone };
    app.openModal(`<h2>Import from Taskmaster 0.4</h2>
      <p>This only reads the file you chose. It doesn't change it, and 0.4 keeps working.</p>
      <div class="stats">
        <div class="stat"><b>${s.open}</b><span>open tasks</span></div>
        <div class="stat"><b>${s.done}</b><span>finished, for the Done tray</span></div>
        <div class="stat"><b>${C.formatDuration(s.seconds)}</b><span>tracked in ${s.sessions} session${s.sessions === 1 ? '' : 's'}</span></div>
        <div class="stat"><b>${s.notes}</b><span>notes</span></div>
      </div>
      ${s.withOthers ? `<p><b>${s.withOthers}</b> task${s.withOthers === 1 ? ' is' : 's are'} assigned to someone other than ${esc(app.data.owner.name)}, and will show a "With [name]" tag.</p>` : ''}
      ${s.alreadyImported ? `<p class="muted">${s.alreadyImported} item${s.alreadyImported === 1 ? ' was' : 's were'} imported before and will be skipped.</p>` : ''}
      <div class="modal-acts"><button class="btn" data-act="cancelImport">Cancel</button><button class="btn primary" data-act="doImport" ${s.newTasks + s.notes === 0 ? 'disabled' : ''}>Import</button></div>`);
  };
  app.actions.cancelImport = () => { const p = pendingImport; pendingImport = null; app.closeModal(); if (p && p.onDone) p.onDone(false); };
  app.actions.doImport = () => {
    const { result, onDone } = pendingImport;
    pendingImport = null;
    app.remember('Import from 0.4');
    if (result.tasks.some(t => t.timerStartedAt)) for (const t of app.tasks()) if (t.timerStartedAt) C.pauseTimer(t, new Date());
    app.data.tasks.push(...result.tasks);
    app.data.notes.push(...result.notes);
    for (const item of [...result.tasks, ...result.notes]) item.clientTag = app.rememberClient(item.clientTag);
    app.closeModal();
    app.needsFit = true;
    app.commit();
    app.toast(`Imported ${result.tasks.length} tasks`, { undo: true });
    if (onDone) onDone(true);
  };
  app.actions.pickImport = menu(() => pickFile(text => app.previewImport(text)));

  /* ---------- wiring ---------- */
  document.addEventListener('click', ev => {
    const pop = $('#popover');
    if (pop && pop.dataset.open && !ev.target.closest('#popover') && !ev.target.closest('[data-act="personMenu"]')) app.closePopover();
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = app.actions[el.dataset.act];
    if (fn) fn(el, ev);
  });
  document.addEventListener('submit', ev => {
    const f = ev.target.dataset && ev.target.dataset.form;
    if (f && app.forms[f]) { ev.preventDefault(); app.forms[f](ev.target, ev); }
  });
  document.addEventListener('keydown', ev => {
    if (!app.data || !$('#top')) return;
    const typing = ev.target.matches && ev.target.matches('input,textarea,select,[contenteditable]');
    if (ev.key === 'Escape') {
      if (app.closeQuickAdd && app.closeQuickAdd()) return;
      if (app.modalOpen()) { app.closeModal(); return; }
      if ($('#popover').dataset.open) { app.closePopover(); return; }
      if (!typing && app.clearPicks && app.clearPicks()) return;
      if (app.ui.panelId && app.actions.closePanel) { app.actions.closePanel(); return; }
      if (app.ui.trayOpen) { app.ui.trayOpen = false; app.render(); return; }
      if (typing) ev.target.blur();
      return;
    }
    if (typing || app.modalOpen()) return;
    if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && ev.key.toLowerCase() === 'z') { ev.preventDefault(); app.actions.undo(); return; }
    if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && ev.key.toLowerCase() === 'a' && app.ui.tab === 'board') { ev.preventDefault(); app.pickAllShowing(); return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const onBoard = app.ui.tab === 'board';
    switch (ev.key) {
      case 'n': case 'N': ev.preventDefault(); app.actions.quickAdd(); break;
      case '?': showShortcuts(); break;
      case '/': if (onBoard) { ev.preventDefault(); const s = $('#boardSearch'); if (s) s.focus(); } break;
      case 't': case 'T': if (app.ui.selectedId) app.toggleTimer(app.ui.selectedId); break;
      case 'f': case 'F': if (onBoard) app.actions.toggleFocus(); break;
      case 'd': case 'D': app.actions.toggleTheme(); break;
      case '1': if (onBoard) app.setCalendar('off'); break;
      case '2': if (onBoard) app.setCalendar('week'); break;
      case '3': if (onBoard) app.setCalendar('month'); break;
      case '0': if (onBoard) app.fitAll(); break;
      case 'v': case 'V': if (onBoard) app.cycleView(); break;
      default:
    }
  });
  root.addEventListener('beforeunload', ev => {
    if (app.isDirty() && app.store) { ev.preventDefault(); ev.returnValue = ''; }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && app.isDirty() && app.store) { clearTimeout(saveTimer); flush(); }
  });

  /* Warn when the app is open twice, because each window would save over the other. */
  try {
    const bc = new BroadcastChannel('taskmaster');
    bc.onmessage = e => {
      if (e.data === 'hello') bc.postMessage('here');
      if ((e.data === 'here' || e.data === 'hello') && app.data) showBanner('tabs', 'Taskmaster is open in another tab or window. Use just one, so they don\'t overwrite each other.', [['OK', () => hideBanner('tabs')]]);
    };
    bc.postMessage('hello');
  } catch (e) { /* older browsers: saving still detects overwrites */ }

  app.start = function () {
    document.body.classList.remove('setup-mode');
    $('#root').innerHTML = `<header id="top" class="top"></header><div id="banners"></div><main id="view"></main><div class="edge"></div><aside id="panel" class="panel" aria-label="Task details"></aside><div id="tray"></div><div id="bulkBar" class="bulk" role="toolbar" aria-label="Change selected tasks"></div><div id="toast" class="toast" role="status"></div><div id="popover" class="popover"></div><div id="quickRoot"></div>`;
    app.needsFit = app.needsFit || false;
    S.setThemeHint(app.prefs().theme);
    paintTheme();
    app.ui.view = app.prefs().defaultView;
    const lastSeen = app.data.savedAt;
    app.lastActiveAt = lastSeen;
    app.render();
    setInterval(tick, 1000);
    tick();
    const run = app.runningTask();
    if (run && C.timerLooksForgotten(run, new Date())) app.askStopTime(run.id, lastSeen, { reopening: true });
  };
})(window);
