/* The board: sticky notes, dragging, zoom, filters, Done tray, task details, quick add, templates. */
(function (root) {
  'use strict';
  const C = root.TMCore, app = root.TMApp;
  const $ = app.$, esc = C.esc;
  let z = 1;

  const boardTasks = () => app.tasks().filter(t => !C.inTray(t, app.today()));
  app.boardTasks = boardTasks;
  const trayTasks = () => app.tasks().filter(t => C.inTray(t, app.today()))
    .sort((a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || '')));

  /* ---------- note markup ---------- */
  function tagLine(t) {
    const bits = [];
    if (t.clientTag) bits.push(t.clientTag);
    if (t.service && C.SERVICES[t.service] && (t.clientTag || t.service === 'personal')) bits.push(C.SERVICES[t.service]);
    if (t.withName) bits.push(`With ${t.withName}`);
    if (t.status === 'waiting') bits.push(t.waitingOn ? `Waiting on ${t.waitingOn}` : 'Waiting');
    return bits.join(' · ');
  }
  app.tagLine = tagLine;
  /* Tracked time, with the same time in decimal hours underneath for Basecamp. */
  app.spentHTML = t => {
    const secs = C.taskSeconds(t, new Date());
    return `<span class="spentbox"><span class="spent" data-time="${esc(t.id)}">${C.formatDuration(secs)}</span><small class="hrs" data-hours="${esc(t.id)}">${esc(C.hoursLabel(secs))}</small></span>`;
  };
  function noteHTML(t) {
    const today = app.today();
    const due = C.dueLabel(t, today, new Date());
    const tag = tagLine(t);
    const width = C.noteWidth(t);
    const prev = C.previewSubtasks(t.subtasks, C.subtaskLimit(width));
    const doneCount = t.subtasks.filter(s => s.done).length;
    const pct = t.subtasks.length ? Math.round(doneCount / t.subtasks.length * 100) : 0;
    const done = C.isDone(t), running = !!t.timerStartedAt;
    return `<article class="n ${esc(t.priority)} ${done ? 'done' : ''} ${running ? 'on' : ''} ${t.color === 'white' ? 'plain' : ''} ${app.ui.selectedId === t.id ? 'sel' : ''}" data-note="${esc(t.id)}" tabindex="0" aria-label="${esc(t.title)}, ${C.PRIORITY_LABEL[t.priority].toLowerCase()} priority" style="left:${t.position ? t.position.x : 0}px;top:${t.position ? t.position.y : 0}px;z-index:${t.z || 0};background-color:${C.COLORS[t.color]};width:${width}px;--k:${C.noteTextScale(width)};--r:${C.noteTilt(t.id)}deg;${t.size && t.size.h ? `min-height:${t.size.h}px;` : ''}">
      <div class="head">${C.priorityBadge(t)}<span class="due ${due.kind}" data-due="${esc(t.id)}">${esc(due.text)}</span></div>
      <h3>${esc(t.title)}</h3>
      ${tag ? `<div class="tag">${esc(tag)}</div>` : ''}
      <div class="added">${esc(C.addedLabel(t, today))}</div>
      ${t.subtasks.length ? `<ul class="subs">${prev.shown.map(s => `<li class="${s.done ? 'd' : ''}"><label><input type="checkbox" data-subtick="${esc(s.id)}" data-task="${esc(t.id)}" ${s.done ? 'checked' : ''}><span>${esc(s.name)}</span></label></li>`).join('')}</ul>
      ${prev.more ? `<div class="more">+${prev.more} more subtask${prev.more === 1 ? '' : 's'}</div>` : ''}
      <div class="prog"><i style="width:${pct}%"></i></div>` : ''}
      <div class="foot">
        ${done ? '' : `<button class="play" data-act="timer" data-id="${esc(t.id)}" aria-label="${running ? 'Pause' : 'Start'} timer" title="${running ? 'Pause' : 'Start'} timer">${running ? '❚❚' : '▶'}</button>`}
        ${app.spentHTML(t)}
        <span class="cnt">${t.subtasks.length ? `${doneCount} of ${t.subtasks.length}` : ''}</span>
        <button class="mini star ${t.star ? 'is' : ''}" data-act="star" data-id="${esc(t.id)}" aria-label="${t.star ? 'Remove from' : 'Add to'} today" aria-pressed="${t.star}" title="Today">${t.star ? '★' : '☆'}</button>
        <button class="mini check ${done ? 'is' : ''}" data-act="toggleDone" data-id="${esc(t.id)}" aria-label="${done ? 'Reopen' : 'Mark as done'}" title="${done ? 'Reopen' : 'Mark as done'}">✓</button>
      </div>
      ${done ? '<span class="stamp">DONE</span>' : ''}
      <span class="grip" data-grip title="Drag to resize. Double-click for the normal size." aria-hidden="true"></span>
    </article>`;
  }

  /* ---------- board frame ---------- */
  function matchesFilters(t) {
    const q = app.ui.search.trim().toLowerCase();
    if (q && ![t.title, t.desc, t.clientTag, t.withName, ...t.subtasks.map(s => s.name)].join(' ').toLowerCase().includes(q)) return false;
    if (app.ui.colorFilter && t.color !== app.ui.colorFilter) return false;
    if (app.ui.focus && !C.inFocus(t, app.today())) return false;
    return true;
  }
  app.matchesFilters = matchesFilters;
  function counts() {
    const today = app.today(), end = C.addDays(C.weekStart(today), 6);
    const open = app.tasks().filter(t => !C.isDone(t));
    const now = new Date();
    return { week: open.filter(t => t.due && t.due >= today && t.due <= end).length, late: open.filter(t => C.isOverdue(t, today, now)).length };
  }
  const statHTML = c => `${c.week} due this week${c.late ? ` · <b>${c.late} overdue</b>` : ''}`;
  app.refreshStatLine = () => { const el = $('#statLine'); if (el) el.innerHTML = statHTML(counts()); };
  function barHTML() {
    const p = app.prefs(), u = app.ui, c = counts();
    const isDefault = p.defaultView === u.view;
    return `
      <span class="seg view-seg" role="group" aria-label="View">${Object.entries(C.VIEWS).map(([k, l]) => `<button class="${u.view === k ? 'on' : ''}" data-act="setView" data-v="${k}" aria-pressed="${u.view === k}">${l}</button>`).join('')}</span>
      <button class="pill def ${isDefault ? 'is' : ''}" data-act="makeDefault" ${isDefault ? 'disabled' : ''} title="${isDefault ? 'Taskmaster opens in this view' : 'Open Taskmaster in this view'}">${isDefault ? '★ Default' : '☆ Make default'}</button>
      <span class="lab">Colour</span>
      <span class="dots">${Object.entries(C.COLORS).map(([k, v]) => `<button style="background:${v}" class="${u.colorFilter === k ? 'on' : ''}" data-act="colorFilter" data-c="${k}" aria-label="Show ${k} notes" aria-pressed="${u.colorFilter === k}" title="${k}"></button>`).join('')}</span>
      <span class="lab">Calendar</span>
      <span class="seg" role="group" aria-label="Calendar">${[['off', 'Off'], ['week', 'Week'], ['month', 'Month']].map(([k, l]) => `<button class="${p.calendar === k ? 'on' : ''}" data-act="calendar" data-c="${k}" aria-pressed="${p.calendar === k}">${l}</button>`).join('')}</span>
      <button class="pill ${u.focus ? 'on' : ''}" data-act="toggleFocus" aria-pressed="${u.focus}">★ Today</button>
      <input id="boardSearch" class="search" type="search" placeholder="Search" value="${esc(u.search)}" aria-label="Search the board">
      <span class="sp"></span>
      <span class="stat-line" id="statLine">${statHTML(c)}</span>`;
  }
  app.views.board = function () {
    const view = $('#view');
    if (!$('#board')) {
      view.innerHTML = `<div class="bar" id="bar"></div>
        <div class="main"><div class="views" id="views"><div class="board" id="board" tabindex="-1"><div class="world" id="world"></div>
          <div class="tools"><button data-act="zoomOut" aria-label="Zoom out">−</button><span id="zoomLabel"></span><button data-act="zoomIn" aria-label="Zoom in">+</button><button data-act="fitAll">Fit all</button><button data-act="tidy">Tidy up</button><i class="tools-sep"></i><button data-act="newArea" title="Add a labelled area to the board">+ Area</button><button data-act="clientAreas" title="Make one area for each client and move their notes into it">Client areas</button></div>
        </div><div class="listv" id="listView"></div><div class="columnsv" id="columnsView"></div>
        <button class="traybtn" id="trayBtn" data-act="toggleTray"></button>
        </div><div class="mo" id="monthPanel"></div></div><div class="wk" id="weekStrip"></div>`;
      bindBoard();
    }
    const active = document.activeElement;
    const searching = active && active.id === 'boardSearch';
    const caret = searching ? active.selectionStart : 0;
    $('#bar').innerHTML = barHTML();
    if (searching) { const s = $('#boardSearch'); s.focus(); s.setSelectionRange(caret, caret); }
    $('#views').dataset.view = app.ui.view;
    refreshTasks();
    $('#trayBtn').innerHTML = `✓ Done tray <b>${trayTasks().length}</b>`;
    if (app.renderCalendar) app.renderCalendar();
    renderTray();
    applyView();
    if (app.needsFit && app.ui.view === 'sticky') { app.needsFit = false; requestAnimationFrame(() => app.fitAll()); }
  };
  /* Redraws whichever task view is showing, and nothing else. */
  function refreshTasks() {
    if (app.ui.view === 'list') app.renderList();
    else if (app.ui.view === 'columns') app.renderColumns();
    else renderWorld();
  }
  app.refreshTasks = refreshTasks;
  app.setView = v => {
    if (!C.VIEWS[v]) return;
    app.ui.view = v;
    app.render();
  };
  app.actions.setView = el => app.setView(el.dataset.v);
  app.cycleView = () => {
    const keys = Object.keys(C.VIEWS);
    app.setView(keys[(keys.indexOf(app.ui.view) + 1) % keys.length]);
  };
  app.actions.makeDefault = () => {
    app.prefs().defaultView = app.ui.view;
    app.commit();
    app.toast(`Taskmaster will open in ${C.VIEWS[app.ui.view]}`, { ms: 3000 });
  };

  function renderWorld() {
    const world = $('#world');
    if (!world) return;
    const list = boardTasks();
    z = Math.max(z, ...list.map(t => t.z || 0), 1);
    const focusId = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.note : null;
    world.innerHTML = app.areasHTML() + list.map(noteHTML).join('');
    world.querySelectorAll('.n').forEach(el => el.classList.toggle('dim', !matchesFilters(app.task(el.dataset.note))));
    placeNewNotes(list);
    if (focusId) { const f = world.querySelector(`[data-note="${CSS.escape(focusId)}"]`); if (f) f.focus({ preventScroll: true }); }
    if (!list.length) world.insertAdjacentHTML('beforeend', '');
    const empty = $('#boardEmpty');
    if (empty) empty.remove();
    if (!list.length) $('#board').insertAdjacentHTML('beforeend', `<div class="empty" id="boardEmpty"><h2>Your board is clear</h2><p>Press <kbd>N</kbd> or use + New task to add a note.</p></div>`);
  }
  function noteEl(id) { return $(`#world [data-note="${CSS.escape(id)}"]`); }
  app.noteEl = noteEl;
  function visibleWorld() {
    const b = $('#board'), p = app.prefs();
    return { x: -p.panX / p.zoom, y: -p.panY / p.zoom, w: b.clientWidth / p.zoom, h: b.clientHeight / p.zoom };
  }
  app.visibleWorld = visibleWorld;
  app.noteRects = () => boardTasks().filter(t => t.position).map(t => { const el = noteEl(t.id); return { x: t.position.x, y: t.position.y, w: C.noteWidth(t), h: el ? el.offsetHeight : 205 }; });
  /* True when a note is out of sight, so a newly added one can be brought into view. */
  app.isOffBoard = el => {
    const b = $('#board').getBoundingClientRect(), r = el.getBoundingClientRect();
    return r.right < b.left || r.left > b.right || r.bottom < b.top || r.top > b.bottom;
  };
  /* Brings a part of the board into view, if it isn't already. */
  app.showWorldRect = rect => {
    const v = visibleWorld();
    if (rect.x >= v.x && rect.y >= v.y && rect.x + Math.min(rect.w, v.w) <= v.x + v.w && rect.y + Math.min(rect.h, v.h) <= v.y + v.h) return;
    const p = app.prefs();
    p.panX = Math.round(30 - rect.x * p.zoom);
    p.panY = Math.round(30 - rect.y * p.zoom);
    applyView();
    app.scheduleSave();
  };
  function placeNewNotes(list) {
    const missing = list.filter(t => !t.position);
    if (!missing.length) return;
    const rects = list.filter(t => t.position).map(t => { const el = noteEl(t.id); return { x: t.position.x, y: t.position.y, w: C.noteWidth(t), h: el ? el.offsetHeight : 190 }; });
    const view = visibleWorld();
    for (const t of missing) {
      const el = noteEl(t.id);
      const h = el ? el.offsetHeight : 190;
      const w = C.noteWidth(t);
      // Notes with a client go to that client's area. Others stay out of the areas.
      t.position = app.spotInClientArea(t, rects, { w, h }) || C.findFreeSpot([...rects, ...app.areaRects()], view, { w, h });
      rects.push({ ...t.position, w, h });
      if (el) { el.style.left = t.position.x + 'px'; el.style.top = t.position.y + 'px'; }
    }
    app.scheduleSave();
  }

  /* ---------- zoom and pan ---------- */
  function applyView() {
    const p = app.prefs(), world = $('#world'), board = $('#board');
    if (!world) return;
    world.style.transform = `translate(${p.panX}px,${p.panY}px) scale(${p.zoom})`;
    world.style.setProperty('--z', p.zoom);
    const size = 18 * p.zoom;
    board.style.backgroundSize = `${size}px ${size}px`;
    board.style.backgroundPosition = `${p.panX}px ${p.panY}px`;
    $('#zoomLabel').textContent = `${Math.round(p.zoom * 100)}%`;
  }
  function zoomAt(next, cx, cy) {
    const p = app.prefs();
    const zoom = Math.min(1.5, Math.max(0.5, next));
    p.panX = cx - (cx - p.panX) * zoom / p.zoom;
    p.panY = cy - (cy - p.panY) * zoom / p.zoom;
    p.zoom = zoom;
    applyView();
    app.scheduleSave();
  }
  const zoomCenter = factor => { const b = $('#board'); zoomAt(app.prefs().zoom * factor, b.clientWidth / 2, b.clientHeight / 2); };
  app.actions.zoomIn = () => zoomCenter(1.15);
  app.actions.zoomOut = () => zoomCenter(1 / 1.15);
  app.fitAll = function () {
    const rects = [...app.noteRects(), ...app.areaRects()], b = $('#board'), p = app.prefs();
    if (!b || !b.clientWidth) return;
    if (!rects.length) { p.zoom = 1; p.panX = 0; p.panY = 0; applyView(); app.scheduleSave(); return; }
    const minX = Math.min(...rects.map(r => r.x)), minY = Math.min(...rects.map(r => r.y));
    const maxX = Math.max(...rects.map(r => r.x + r.w)), maxY = Math.max(...rects.map(r => r.y + r.h));
    const pad = 30;
    const zoom = Math.min(1, Math.max(0.5, Math.min((b.clientWidth - pad * 2) / (maxX - minX || 1), (b.clientHeight - pad * 2) / (maxY - minY || 1))));
    p.zoom = zoom;
    p.panX = Math.round((b.clientWidth - (maxX - minX) * zoom) / 2 - minX * zoom);
    p.panY = Math.round(Math.max(pad, (b.clientHeight - (maxY - minY) * zoom) / 2) - minY * zoom);
    applyView();
    app.scheduleSave();
  };
  app.actions.fitAll = () => app.fitAll();
  app.actions.tidy = () => {
    const list = boardTasks();
    if (!list.length) return;
    const b = $('#board'), view = visibleWorld();
    app.tidyWithAreas(list, { x: view.x + 24, y: view.y + 20, w: Math.max(C.NOTE_W, b.clientWidth / app.prefs().zoom - 48) });
    requestAnimationFrame(() => app.fitAll());
  };
  app.actions.colorFilter = el => { app.ui.colorFilter = app.ui.colorFilter === el.dataset.c ? null : el.dataset.c; app.render(); };
  app.actions.toggleFocus = () => { app.ui.focus = !app.ui.focus; app.render(); };
  app.setCalendar = c => { app.prefs().calendar = c; app.commit(); };
  app.actions.calendar = el => app.setCalendar(el.dataset.c);

  /* ---------- pointer handling ---------- */
  let spaceHeld = false;
  function bindBoard() {
    const board = $('#board');
    board.addEventListener('pointerdown', onPointerDown);
    board.addEventListener('wheel', ev => {
      ev.preventDefault();
      const r = board.getBoundingClientRect();
      if (ev.ctrlKey || ev.metaKey) { zoomAt(app.prefs().zoom * Math.exp(-ev.deltaY * 0.0015), ev.clientX - r.left, ev.clientY - r.top); return; }
      const p = app.prefs();
      p.panX -= ev.deltaX; p.panY -= ev.deltaY;
      applyView();
      app.scheduleSave();
    }, { passive: false });
    board.addEventListener('dblclick', ev => {
      if (!ev.target.closest('[data-grip]')) return;
      const t = app.task(ev.target.closest('.n').dataset.note);
      if (t && t.size) app.change('Reset note size', () => { t.size = null; }, { toast: 'Note back to normal size' });
    });
    board.addEventListener('contextmenu', ev => {
      const el = ev.target.closest('.n');
      if (el) { ev.preventDefault(); colorMenu(el.dataset.note, ev.clientX, ev.clientY); }
    });
    board.addEventListener('focusin', ev => { const el = ev.target.closest && ev.target.closest('.n'); if (el) app.ui.selectedId = el.dataset.note; });
    board.addEventListener('keydown', ev => {
      const el = ev.target.classList && ev.target.classList.contains('n') ? ev.target : null;
      if (!el) return;
      const t = app.task(el.dataset.note);
      const step = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] }[ev.key];
      if (step && ev.shiftKey) {
        ev.preventDefault();
        const w = C.noteWidth(t) + step[0] - step[1];
        t.size = { w: Math.min(C.NOTE_MAX_W, Math.max(C.NOTE_MIN_W, w)), h: t.size ? t.size.h : null };
        app.commit();
        return;
      }
      if (step && t.position) {
        ev.preventDefault();
        t.position = { x: t.position.x + step[0], y: t.position.y + step[1] };
        el.style.left = t.position.x + 'px'; el.style.top = t.position.y + 'px';
        app.scheduleSave();
      }
      if (ev.key === 'Enter') { ev.preventDefault(); openPanel(t.id); }
    });
    $('#bar').addEventListener('input', ev => {
      if (ev.target.id === 'boardSearch') {
        app.ui.search = ev.target.value;
        if (app.ui.view === 'sticky') $('#world').querySelectorAll('.n').forEach(n => n.classList.toggle('dim', !matchesFilters(app.task(n.dataset.note))));
        else refreshTasks();
      }
    });
  }
  document.addEventListener('keydown', ev => {
    if (ev.code === 'Space' && !ev.target.matches('input,textarea,select,button,[contenteditable]') && app.ui.tab === 'board') {
      ev.preventDefault();
      spaceHeld = true;
      const b = $('#board');
      if (b) b.classList.add('grab');
    }
  });
  document.addEventListener('keyup', ev => {
    if (ev.code === 'Space') { spaceHeld = false; const b = $('#board'); if (b) b.classList.remove('grab'); }
  });

  function onPointerDown(ev) {
    if (ev.button !== 0) return;
    if (ev.target.closest('[data-grip]') && !spaceHeld) { resizeNote(ev, ev.target.closest('.n')); return; }
    const inArea = ev.target.closest('.area');
    if (inArea && !spaceHeld && !ev.shiftKey) {
      if (ev.target.closest('[data-area-grip]')) { app.resizeArea(ev, inArea); return; }
      if (ev.target.closest('.area-head') && !ev.target.closest('input,button')) { app.moveArea(ev, inArea); return; }
    }
    const inControl = ev.target.closest('button,input,label,a,.tools,.traybtn');
    const noteNode = ev.target.closest('.n');
    if (noteNode && !spaceHeld) {
      if (inControl) return;
      dragNote(ev, noteNode);
    } else if (ev.shiftKey && !inControl && !spaceHeld) {
      boxSelect(ev);
    } else if (!inControl || spaceHeld) {
      panBoard(ev);
    }
  }
  /* Shift + drag on the empty board selects every note the box touches. */
  function boxSelect(ev) {
    ev.preventDefault();
    const board = $('#board'), b = board.getBoundingClientRect(), sx = ev.clientX, sy = ev.clientY;
    const box = document.createElement('div');
    box.className = 'marquee';
    board.appendChild(box);
    let l = sx, t = sy, r = sx, bt = sy;
    const move = e => {
      l = Math.min(sx, e.clientX); r = Math.max(sx, e.clientX); t = Math.min(sy, e.clientY); bt = Math.max(sy, e.clientY);
      box.style.cssText = `left:${l - b.left}px;top:${t - b.top}px;width:${r - l}px;height:${bt - t}px`;
    };
    const up = e => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      box.remove();
      if (e.type === 'pointercancel' || r - l < 5 || bt - t < 5) return;
      const hits = [...$('#world').querySelectorAll('.n:not(.dim)')].filter(n => {
        const q = n.getBoundingClientRect();
        return q.left < r && q.right > l && q.top < bt && q.bottom > t;
      });
      app.addPicks(hits.map(n => n.dataset.note));
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }
  function panBoard(ev) {
    const board = $('#board'), p = app.prefs();
    const sx = ev.clientX - p.panX, sy = ev.clientY - p.panY;
    let moved = false;
    board.classList.add('panning');
    const move = e => { p.panX = e.clientX - sx; p.panY = e.clientY - sy; moved = true; applyView(); };
    const up = () => {
      board.classList.remove('panning');
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      if (moved) app.scheduleSave();
      else {
        app.clearPicks();
        if (app.ui.selectedId) { app.ui.selectedId = null; document.querySelectorAll('.n.sel').forEach(n => n.classList.remove('sel')); }
      }
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }
  function dragNote(ev, el) {
    const id = el.dataset.note, t = app.task(id);
    const start = { ...t.position }, sx = ev.clientX, sy = ev.clientY, zoom = app.prefs().zoom;
    // Dragging a selected note brings the rest of the selection along.
    const others = app.isPicked(id) ? app.pickedTasks().filter(o => o !== t && o.position && noteEl(o.id)).map(o => ({ t: o, el: noteEl(o.id), x: o.position.x, y: o.position.y })) : [];
    let moved = false;
    const tray = $('#trayBtn');
    const overTray = e => { const r = tray.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; };
    const move = e => {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      if (!moved) {
        moved = true;
        el.classList.add('moving');
        el.style.zIndex = 100000;
        for (const o of others) { o.el.classList.add('moving'); o.el.style.zIndex = 99999; }
      }
      el.style.left = start.x + dx / zoom + 'px';
      el.style.top = start.y + dy / zoom + 'px';
      for (const o of others) { o.el.style.left = o.x + dx / zoom + 'px'; o.el.style.top = o.y + dy / zoom + 'px'; }
      tray.classList.toggle('drop', overTray(e));
      app.showDropArea(e.clientX, e.clientY);
    };
    const up = e => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      tray.classList.remove('drop');
      el.classList.remove('moving');
      for (const o of others) o.el.classList.remove('moving');
      app.showDropArea(null);
      if (!moved) {
        if (e.shiftKey || e.ctrlKey || e.metaKey) { app.togglePick(id); return; }
        app.clearPicks();
        openPanel(id);
        return;
      }
      if (overTray(e)) {
        if (others.length) { const group = [t, ...others.map(o => o.t)]; app.clearPicks(); app.finishMany(group, { at: [e.clientX, e.clientY] }); }
        else if (!C.isDone(t)) app.finish(t, { at: [e.clientX, e.clientY] });
        return;
      }
      const dx = (e.clientX - sx) / zoom, dy = (e.clientY - sy) / zoom, now = new Date().toISOString();
      app.remember(others.length ? 'Move notes' : 'Move note');
      t.position = { x: Math.round(start.x + dx), y: Math.round(start.y + dy) };
      t.z = ++z;
      t.updatedAt = now;
      app.fitNoteInArea(t);
      for (const o of others) {
        o.t.position = { x: Math.round(o.x + dx), y: Math.round(o.y + dy) };
        o.t.z = ++z;
        o.t.updatedAt = now;
        o.el.style.zIndex = o.t.z;
        app.fitNoteInArea(o.t);
      }
      app.scheduleSave();
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }
  function resizeNote(ev, el) {
    ev.preventDefault();
    const t = app.task(el.dataset.note), zoom = app.prefs().zoom;
    const sx = ev.clientX, sy = ev.clientY, startW = el.offsetWidth, startH = el.offsetHeight;
    let moved = false, w = startW, h = startH;
    el.classList.add('resizing');
    const move = e => {
      const dx = (e.clientX - sx) / zoom, dy = (e.clientY - sy) / zoom;
      if (!moved && Math.hypot(dx, dy) < 2) return;
      moved = true;
      w = Math.round(Math.min(C.NOTE_MAX_W, Math.max(C.NOTE_MIN_W, startW + dx)));
      h = Math.round(Math.min(C.NOTE_MAX_H, Math.max(0, startH + dy)));
      el.style.width = w + 'px';
      el.style.minHeight = h + 'px';
      el.style.setProperty('--k', C.noteTextScale(w));
    };
    const up = () => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      el.classList.remove('resizing');
      if (!moved) return;
      el.style.minHeight = '0';
      const natural = el.offsetHeight; // a height only needs saving when the note is taller than its contents
      app.remember('Resize note');
      t.size = { w, h: h > natural + 4 ? h : null };
      t.z = ++z;
      t.updatedAt = new Date().toISOString();
      app.commit();
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }
  function colorMenu(id, x, y) {
    const host = $('#popover'), t = app.task(id);
    host.dataset.open = 'color';
    host.style.cssText = `left:${x}px;top:${y}px;right:auto;display:block`;
    host.innerHTML = `<div class="menu color-menu"><div class="menu-head"><small>Note colour</small></div><div class="dots">${Object.entries(C.COLORS).map(([k, v]) => `<button style="background:${v}" class="${t.color === k ? 'on' : ''}" data-act="setColor" data-id="${esc(id)}" data-c="${k}" aria-label="${k}" title="${k}"></button>`).join('')}</div></div>`;
  }
  app.actions.setColor = el => {
    const t = app.task(el.dataset.id);
    if (t) { t.color = el.dataset.c; t.updatedAt = new Date().toISOString(); }
    app.closePopover();
    app.commit();
  };

  /* Pans to a note and highlights it, wherever the person currently is. */
  app.jumpTo = function (id) {
    const t = app.task(id);
    if (!t) return;
    if (C.inTray(t, app.today())) { openPanel(id); return; }
    if (app.ui.tab !== 'board') { app.ui.tab = 'board'; $('#view').innerHTML = ''; app.render(); }
    if (app.ui.view !== 'sticky') {
      const found = app.taskEl(id);
      if (!found) { openPanel(id); return; }
      found.scrollIntoView({ block: 'center' });
      found.classList.remove('flash');
      void found.offsetWidth;
      found.classList.add('flash');
      return;
    }
    const b = $('#board'), p = app.prefs(), el = noteEl(id);
    if (!t.position || !el) return;
    p.panX = Math.round(b.clientWidth / 2 - (t.position.x + C.noteWidth(t) / 2) * p.zoom);
    p.panY = Math.round(b.clientHeight / 2 - (t.position.y + el.offsetHeight / 2) * p.zoom);
    applyView();
    app.ui.selectedId = id;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
    app.scheduleSave();
  };
  app.actions.jump = el => app.jumpTo(el.dataset.id);

  /* ---------- Done tray ---------- */
  app.actions.toggleTray = () => { app.ui.trayOpen = !app.ui.trayOpen; renderTray(); };
  function renderTray() {
    const host = $('#tray');
    if (!host) return;
    if (!app.ui.trayOpen) { host.innerHTML = ''; return; }
    const list = trayTasks();
    host.innerHTML = `<div class="drawer" role="dialog" aria-label="Done tray"><div class="drawer-head"><h2>Done tray</h2><button class="iconbtn" data-act="toggleTray" aria-label="Close">✕</button></div>
      <div class="drawer-list">${list.length ? list.map(t => `<div class="tray-row"><span class="swatch" style="background:${C.COLORS[t.color]}"></span><button class="linkbtn tray-name" data-act="openPanel" data-id="${esc(t.id)}">${esc(t.title)}</button><small>${t.completedAt ? esc(C.fmtDay(C.localDate(t.completedAt) || app.today())) : ''}${C.taskSeconds(t) ? ` · ${C.formatDuration(C.taskSeconds(t))}${C.hoursLabel(C.taskSeconds(t)) ? ` (${C.hoursLabel(C.taskSeconds(t))})` : ''}` : ''}</small><button class="btn small" data-act="toggleDone" data-id="${esc(t.id)}">Restore</button></div>`).join('') : '<p class="muted">Finished tasks fly in here.</p>'}</div></div>`;
  }

  /* ---------- task details panel ---------- */
  function openPanel(id) {
    if (app.ui.panelId && app.ui.panelId !== id) leavePanel();
    app.ui.panelId = id;
    app.ui.selectedId = id;
    document.querySelectorAll('.n.sel').forEach(n => n.classList.remove('sel'));
    const el = noteEl(id);
    if (el) el.classList.add('sel');
    app.renderPanel(true);
  }
  app.openPanel = openPanel;
  app.actions.openPanel = el => openPanel(el.dataset.id);
  function leavePanel() {
    const t = app.task(app.ui.panelId);
    if (t) maybeOfferTemplate(t);
  }
  app.actions.closePanel = () => {
    leavePanel();
    app.ui.panelId = null;
    app.renderPanel(true);
  };
  let panelDrawnFor = null;
  app.renderPanel = function (force) {
    const host = $('#panel');
    if (!host) return;
    const t = app.ui.panelId ? app.task(app.ui.panelId) : null;
    if (!t) { host.classList.remove('open'); host.innerHTML = ''; panelDrawnFor = null; return; }
    // Keeps what someone is typing in place when something else on the page redraws.
    const active = document.activeElement;
    if (!force && panelDrawnFor === t.id && active && host.contains(active) && active.matches('input,textarea,select')) { refreshPanelTime(t); return; }
    host.classList.add('open');
    panelDrawnFor = t.id;
    const scroll = host.scrollTop;
    host.innerHTML = panelHTML(t);
    host.scrollTop = scroll;
    const title = host.querySelector('[data-f="title"]');
    if (title) autoGrow(title);
    host.querySelectorAll('textarea').forEach(autoGrow);
  };
  function refreshPanelTime(t) {
    const list = $('#panelSessions');
    if (list && !list.contains(document.activeElement)) list.innerHTML = sessionsHTML(t);
  }
  const autoGrow = el => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px'; };
  function sessionsHTML(t) {
    const rows = [...t.timeSessions].map((s, i) => ({ s, i })).sort((a, b) => String(b.s.startedAt).localeCompare(String(a.s.startedAt)));
    if (!rows.length) return '<p class="muted small">No time tracked yet.</p>';
    return rows.map(({ s, i }) => {
      const d = new Date(s.startedAt);
      const valid = !Number.isNaN(d.getTime());
      const time = valid ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
      return `<div class="sess" data-i="${i}"><input type="date" aria-label="Date" data-sess="date" value="${valid ? C.todayISO(d) : ''}"><input type="time" aria-label="Start time" data-sess="time" value="${time}"><input class="dur" aria-label="Duration" data-sess="dur" value="${esc(C.formatDuration(s.seconds))}"><button class="iconbtn" data-act="delSession" data-i="${i}" aria-label="Delete session">✕</button></div>`;
    }).join('');
  }
  function panelHTML(t) {
    const tags = app.clientNames();
    const seg = (field, opts, cur) => `<span class="seg" role="group">${opts.map(([k, l]) => `<button class="${cur === k ? 'on' : ''}" data-act="panelSet" data-f="${field}" data-v="${k}" aria-pressed="${cur === k}">${l}</button>`).join('')}</span>`;
    const running = !!t.timerStartedAt, done = C.isDone(t);
    return `<div class="panel-top"><button class="iconbtn star ${t.star ? 'is' : ''}" data-act="star" data-id="${esc(t.id)}" aria-label="Today" title="Today">${t.star ? '★' : '☆'}</button><span class="sp"></span><button class="iconbtn" data-act="closePanel" aria-label="Close details">✕</button></div>
      <textarea class="ptitle" data-f="title" rows="1" aria-label="Title">${esc(t.title)}</textarea>
      <div class="added panel-added">${esc(C.addedLabel(t, app.today()))}</div>
      <div class="pgrid">
        <div class="lab">Priority</div>${seg('priority', C.PRIORITIES.map(p => [p, C.PRIORITY_LABEL[p]]), t.priority)}
        <div class="lab">Status</div>${seg('status', C.STATUSES.map(p => [p, C.STATUS_LABEL[p]]), t.status)}
        ${t.status === 'waiting' ? `<div class="lab">Waiting on</div><input data-f="waitingOn" value="${esc(t.waitingOn)}" placeholder="Who or what">` : ''}
        <div class="lab">Colour</div><span class="dots">${Object.entries(C.COLORS).map(([k, v]) => `<button style="background:${v}" class="${t.color === k ? 'on' : ''}" data-act="panelSet" data-f="color" data-v="${k}" aria-label="${k}" title="${k}"></button>`).join('')}</span>
        <div class="lab">Start</div><input type="date" data-f="start" value="${esc(t.start || '')}">
        <div class="lab">Due</div><span class="datetime"><input type="date" data-f="due" value="${esc(t.due || '')}" aria-label="Due date"><input type="time" data-f="dueTime" value="${esc(t.dueTime || '')}" aria-label="Due time"></span>
        <div class="lab">Client</div><input data-f="clientTag" list="tagList" value="${esc(t.clientTag)}" placeholder="Optional"><datalist id="tagList">${tags.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
        <div class="lab">Service</div><select data-f="service"><option value="">None</option>${Object.entries(C.SERVICES).map(([k, l]) => `<option value="${k}" ${t.service === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <div class="lab">With</div><input data-f="withName" value="${esc(t.withName)}" placeholder="Someone else on this task">
        <div class="lab">Repeats</div><select data-f="recurrence">${[['none', 'Never'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([k, l]) => `<option value="${k}" ${t.recurrence === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </div>
      ${t.start && t.due && t.start > t.due ? '<p class="warn small">The start date is after the due date.</p>' : ''}
      <div class="lab sect">Description</div>
      <textarea data-f="desc" rows="3" placeholder="Details, links, anything useful">${esc(t.desc)}</textarea>
      <div class="lab sect">Subtasks</div>
      <div class="psubs">${t.subtasks.map(s => `<div class="psub"><input type="checkbox" data-psub="${esc(s.id)}" ${s.done ? 'checked' : ''} aria-label="Done"><input class="psub-name" data-psubname="${esc(s.id)}" value="${esc(s.name)}" aria-label="Subtask"><button class="iconbtn" data-act="delSub" data-sid="${esc(s.id)}" aria-label="Delete subtask">✕</button></div>`).join('')}</div>
      <input id="addSub" placeholder="Add a subtask and press Enter">
      <div class="lab sect">Time</div>
      <div class="ptime"><span class="ptotal"><b data-time="${esc(t.id)}">${C.formatDuration(C.taskSeconds(t, new Date()))}</b><button class="hrsbtn" data-act="copyHours" data-id="${esc(t.id)}" data-hours="${esc(t.id)}" title="Copy these hours for Basecamp">${esc(C.hoursLabel(C.taskSeconds(t, new Date())))}</button><button class="btn small" data-act="editTime" data-id="${esc(t.id)}">Edit</button></span>${done ? '' : `<button class="btn small ${running ? '' : 'primary'}" data-act="timer" data-id="${esc(t.id)}">${running ? '❚❚ Pause timer' : '▶ Start timer'}</button>`}${running ? `<button class="btn small" data-act="stopEarlier" data-id="${esc(t.id)}">I stopped earlier</button>` : ''}<button class="btn small" data-act="addSession">Add time</button></div>
      <div id="panelSessions">${sessionsHTML(t)}</div>
      <div class="panel-foot"><button class="btn small" data-act="templateFromPanel">Save as template</button><span class="sp"></span><button class="btn small danger" data-act="deleteTask">Delete task</button></div>`;
  }
  const panelTask = () => app.task(app.ui.panelId);
  app.actions.panelSet = el => {
    const t = panelTask(), f = el.dataset.f, v = el.dataset.v;
    if (!t || t[f] === v) return;
    if (f === 'status') {
      const wasDone = C.isDone(t);
      if (v === 'done') { app.finish(t); app.renderPanel(true); return; }
      if (wasDone) { t.completedAt = null; t.tucked = false; app.fx.sound('restore'); }
    }
    t[f] = v;
    t.updatedAt = new Date().toISOString();
    app.commit();
    app.renderPanel(true);
  };
  document.addEventListener('input', ev => {
    const panel = ev.target.closest && ev.target.closest('#panel');
    if (!panel) return;
    const t = panelTask();
    if (!t) return;
    if (ev.target.tagName === 'TEXTAREA') autoGrow(ev.target);
    const f = ev.target.dataset.f;
    if (f && ['title', 'desc', 'clientTag', 'withName', 'waitingOn'].includes(f)) {
      t[f] = f === 'title' ? ev.target.value.replace(/\n/g, ' ') : ev.target.value;
      t.updatedAt = new Date().toISOString();
      refreshNoteOnly();
      app.scheduleSave();
    }
    if (ev.target.dataset.psubname) {
      const s = t.subtasks.find(x => x.id === ev.target.dataset.psubname);
      if (s) { s.name = ev.target.value; refreshNoteOnly(); app.scheduleSave(); }
    }
  });
  function refreshNoteOnly() { if (app.ui.tab === 'board') refreshTasks(); else app.views[app.ui.tab](); }
  document.addEventListener('change', ev => {
    const panel = ev.target.closest && ev.target.closest('#panel');
    if (!panel) return;
    const t = panelTask();
    if (!t) return;
    const f = ev.target.dataset.f;
    if (f === 'clientTag') {
      t.clientTag = app.rememberClient(ev.target.value);
      ev.target.value = t.clientTag;
      t.updatedAt = new Date().toISOString();
      app.scheduleSave();
      return;
    }
    if (f === 'title' && !ev.target.value.trim()) { t.title = 'Untitled task'; ev.target.value = t.title; refreshNoteOnly(); app.scheduleSave(); return; }
    if (f && ['start', 'due', 'dueTime', 'service', 'recurrence'].includes(f)) {
      const v = ev.target.value;
      if (f === 'start' || f === 'due' || f === 'dueTime') t[f] = v || null;
      else t[f] = v;
      if (f === 'due' && !t.due) t.dueTime = null;
      if (f === 'dueTime' && t.dueTime && !t.due) t.due = app.today();
      if (f === 'due' && t.due) t.recurrenceAnchorDay = Number(t.due.slice(8));
      if (f === 'recurrence') t.recurrenceSpawned = false;
      t.updatedAt = new Date().toISOString();
      app.commit();
      app.renderPanel(true);
      return;
    }
    if (ev.target.dataset.psub) {
      const s = t.subtasks.find(x => x.id === ev.target.dataset.psub);
      if (s) { s.done = ev.target.checked; t.updatedAt = new Date().toISOString(); app.commit(); }
      return;
    }
    if (ev.target.dataset.sess) changeSession(t, ev.target);
  });
  function changeSession(t, input) {
    const row = input.closest('.sess'), s = t.timeSessions[Number(row.dataset.i)];
    if (!s) return;
    const date = row.querySelector('[data-sess="date"]').value, time = row.querySelector('[data-sess="time"]').value;
    const seconds = C.parseDuration(row.querySelector('[data-sess="dur"]').value);
    const started = new Date(`${date}T${time || '00:00'}`);
    if (!seconds || Number.isNaN(started.getTime())) {
      app.toast('Please enter a valid date and a duration like 1h 20m. The session was not changed.', { ms: 6000 });
      app.renderPanel(true);
      return;
    }
    app.change('Edit time', () => {
      s.startedAt = started.toISOString();
      s.seconds = seconds;
      s.endedAt = new Date(started.getTime() + seconds * 1000).toISOString();
      t.updatedAt = new Date().toISOString();
    });
    app.renderPanel(true);
  }
  app.actions.addSession = () => {
    const t = panelTask();
    if (!t) return;
    const end = new Date(), start = new Date(end.getTime() - 30 * 60000);
    app.change('Add time', () => t.timeSessions.push({ id: C.uid(), startedAt: start.toISOString(), endedAt: end.toISOString(), seconds: 1800 }));
    app.renderPanel(true);
  };
  app.actions.delSession = el => {
    const t = panelTask();
    if (!t) return;
    app.change('Delete time', () => t.timeSessions.splice(Number(el.dataset.i), 1), { toast: 'Time session deleted' });
    app.renderPanel(true);
  };
  app.actions.delSub = el => {
    const t = panelTask();
    if (!t) return;
    app.change('Delete subtask', () => { t.subtasks = t.subtasks.filter(s => s.id !== el.dataset.sid); });
    app.renderPanel(true);
  };
  app.actions.deleteTask = () => {
    const t = panelTask();
    if (!t) return;
    app.ui.panelId = null;
    app.fx.poof(app.fx.lift(app.taskEl(t.id)));
    app.fx.sound('remove');
    app.change('Delete task', () => {
      C.pauseTimer(t, new Date());
      app.data.tasks = app.data.tasks.filter(x => x.id !== t.id);
    }, { toast: `Deleted: ${t.title}` });
  };
  document.addEventListener('keydown', ev => {
    if (ev.target.id === 'addSub' && ev.key === 'Enter') {
      ev.preventDefault();
      const t = panelTask(), name = ev.target.value.trim();
      if (!t || !name) return;
      t.subtasks.push({ id: C.uid(), name, done: false });
      t.updatedAt = new Date().toISOString();
      app.commit();
      app.renderPanel(true);
      const again = $('#addSub');
      if (again) again.focus();
    }
    if (ev.target.classList && ev.target.classList.contains('ptitle') && ev.key === 'Enter') { ev.preventDefault(); ev.target.blur(); }
  });

  /* ---------- templates ---------- */
  function saveTemplate(t) {
    const name = t.title;
    app.data.templates = app.data.templates.filter(x => x.name.toLowerCase() !== name.toLowerCase());
    app.data.templates.push(C.makeTemplate(t, name));
    app.scheduleSave();
  }
  function maybeOfferTemplate(t) {
    if (!app.prefs().templatePrompt || t.templatePrompted || !t.subtasks.length) return;
    t.templatePrompted = true;
    app.scheduleSave();
    const n = t.subtasks.length;
    app.showBanner('template', `Save <b>${esc(t.title)}</b> as a template? Next time, it starts with ${n === 1 ? 'this subtask' : `these ${n} subtasks`} ready.`, [
      ['Save template', () => { saveTemplate(t); app.hideBanner('template'); app.toast(`Template saved: ${t.title}`, { ms: 3000 }); }],
      ['Not now', () => app.hideBanner('template')],
      ["Don't ask again", () => { app.prefs().templatePrompt = false; app.scheduleSave(); app.hideBanner('template'); }],
    ]);
  }
  app.actions.templateFromPanel = () => {
    const t = panelTask();
    if (t) { t.templatePrompted = true; saveTemplate(t); app.toast(`Template saved: ${t.title}`, { ms: 3000 }); }
  };
  app.actions.manageTemplates = () => {
    app.closePopover();
    const list = app.data.templates;
    app.openModal(`<h2>Templates</h2>${list.length ? `<div class="rows">${list.map(t => `<div class="row"><input data-tplname="${esc(t.id)}" value="${esc(t.name)}" aria-label="Template name"><small>${(t.subtasks || []).length} subtasks</small><button class="btn small danger" data-act="delTemplate" data-id="${esc(t.id)}">Delete</button></div>`).join('')}</div>` : '<p class="muted">No templates yet. After you create a note with subtasks, you\'ll be asked whether to save it as one.</p>'}<div class="modal-acts"><button class="btn primary" data-act="closeModal">Close</button></div>`);
  };
  app.actions.delTemplate = el => {
    app.remember('Delete template');
    app.data.templates = app.data.templates.filter(t => t.id !== el.dataset.id);
    app.scheduleSave();
    app.actions.manageTemplates();
  };
  document.addEventListener('change', ev => {
    const id = ev.target.dataset && ev.target.dataset.tplname;
    if (!id) return;
    const t = app.data.templates.find(x => x.id === id), v = ev.target.value.trim();
    if (t && v) { t.name = v; app.scheduleSave(); } else if (t) ev.target.value = t.name;
  });

  /* ---------- new task box ---------- */
  const quick = { open: false, ignore: [], user: {}, pickedTpl: '', items: [] };
  const freshUser = () => ({ addedSubs: [], removedSubs: [] });
  app.actions.quickAdd = () => {
    if (quick.open) return;
    quick.open = true;
    quick.ignore = [];
    quick.user = freshUser();
    quick.pickedTpl = '';
    const seg = (field, opts) => `<span class="seg" role="group">${opts.map(([k, l]) => `<button type="button" data-act="quickSet" data-f="${field}" data-v="${k}">${l}</button>`).join('')}</span>`;
    $('#quickRoot').innerHTML = `<div class="scrim light" data-act="quickScrim"><div class="quick" role="dialog" aria-label="New task">
      <input id="quickInput" autocomplete="off" placeholder="Task name, e.g. Monthly report fri !high #clinic" aria-label="Task name">
      <div class="chips" id="quickChips"></div><div class="suggest" id="quickSuggest"></div>
      <div class="qgrid">
        <label class="qf"><span class="lab">Template</span><select data-q="template"></select></label>
        <label class="qf"><span class="lab">Client</span><input data-q="clientTag" list="quickTags" autocomplete="off" placeholder="Pick or type a client"><datalist id="quickTags"></datalist><small class="qclient-new" id="qClientNew"></small></label>
        <label class="qf"><span class="lab">Service</span><select data-q="service"><option value="">None</option>${Object.entries(C.SERVICES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
        <div class="qf"><span class="lab">Priority</span>${seg('priority', C.PRIORITIES.map(p => [p, C.PRIORITY_LABEL[p]]))}</div>
        <div class="qf"><span class="lab">Due</span><span class="datetime"><input type="date" data-q="due" aria-label="Due date"><input type="time" data-q="dueTime" aria-label="Due time"></span></div>
        <label class="qf"><span class="lab">Start</span><input type="date" data-q="start"></label>
        <div class="qf"><span class="lab">Status</span>${seg('status', [['progress', 'In progress'], ['waiting', 'Waiting']])}</div>
        <label class="qf"><span class="lab">Repeats</span><select data-q="recurrence"><option value="none">Never</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
        <label class="qf"><span class="lab">With</span><input data-q="withName" autocomplete="off" placeholder="Someone else on this"></label>
        <label class="qf qwaiting" id="qWaiting"><span class="lab">Waiting on</span><input data-q="waitingOn" autocomplete="off" placeholder="Who or what"></label>
      </div>
      <div class="qrow"><span class="lab">Colour</span><span class="dots" id="qColors">${Object.entries(C.COLORS).map(([k, v]) => `<button type="button" style="background:${v}" data-act="quickSet" data-f="color" data-v="${k}" aria-label="${k}" title="${k}"></button>`).join('')}</span><span class="sp"></span><button type="button" class="pill" id="qStar" data-act="quickStar"></button></div>
      <div class="qsplit">
        <div class="qf"><span class="lab">Subtasks</span><div id="qSubs"></div><input id="qAddSub" autocomplete="off" placeholder="Add a subtask and press Enter" aria-label="Add a subtask"></div>
        <label class="qf"><span class="lab">Notes</span><textarea data-q="desc" rows="3" placeholder="Details, links, anything useful"></textarea></label>
      </div>
      <div class="qrow qtime"><label class="inline"><span class="lab">Time already spent</span><input data-q="spent" autocomplete="off" placeholder="e.g. 1h 20m"></label><label class="tick"><input type="checkbox" data-q="startTimer"><span>Start the timer now</span></label><small class="warn" id="qSpentNote" role="alert"></small></div>
      <div class="quick-hint"><span><kbd>Enter</kbd> create</span><span><kbd>Ctrl+Enter</kbd> create and open</span><span><kbd>Shift+Enter</kbd> add another</span><span><kbd>Esc</kbd> close</span><span>Only the name is needed. In the name, try: fri, 12 nov, 14:30, 3pm, !high, !low, #client, /template</span></div>
      <div class="modal-acts wrap"><label class="tick qsave" title="Saves the name, priority, client, service, colour, notes and subtasks. Dates and time aren't saved."><input type="checkbox" id="qSaveTpl"><span>Save as template</span></label><button type="button" class="btn" data-act="closeQuick">Cancel</button><button type="button" class="btn" data-act="quickCreate" data-mode="another">Create and add another</button><button type="button" class="btn primary" data-act="quickCreate" data-mode="plain">Create task</button></div>
    </div></div>`;
    fillQuickLists();
    $('#quickInput').focus();
    refreshQuick();
  };
  function fillQuickLists() {
    $('#quickTags').innerHTML = app.clientNames().map(x => `<option value="${esc(x)}">`).join('');
    $('[data-q="template"]').innerHTML = `<option value="">None</option>${app.data.templates.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}`;
  }
  app.closeQuickAdd = () => {
    if (!quick.open) return false;
    quick.open = false;
    $('#quickRoot').innerHTML = '';
    return true;
  };
  app.actions.closeQuick = () => app.closeQuickAdd();
  /* Clicking outside only closes an empty box, so a half-filled task isn't lost. */
  app.actions.quickScrim = (el, ev) => {
    if (ev.target !== el) return;
    const u = quick.user;
    const started = $('#quickInput').value.trim() || quick.pickedTpl || u.addedSubs.length || Object.keys(u).length > 2 || $('#qAddSub').value.trim();
    if (started) { $('#quickInput').focus(); return; }
    app.closeQuickAdd();
  };
  const quickCtx = () => ({ today: app.today(), now: new Date(), clientTags: app.clientNames(), templates: app.data.templates, ignore: quick.ignore });
  function quickNow() {
    const parsed = C.parseQuickAdd($('#quickInput').value, quickCtx());
    const tpl = app.data.templates.find(t => t.id === (parsed.templateId || quick.pickedTpl)) || null;
    return { parsed, tpl, v: C.quickValues(parsed, tpl, quick.user) };
  }
  /* Shows the current values in every field, leaving alone the one being typed in. */
  function showQuickFields(v, tpl) {
    const box = $('.quick');
    box.querySelectorAll('[data-q]').forEach(el => {
      if (el === document.activeElement) return;
      const f = el.dataset.q;
      if (f === 'template') el.value = tpl ? tpl.id : '';
      else if (f === 'startTimer') el.checked = v.startTimer;
      else if (f === 'spent') el.value = v.spent;
      else el.value = v[f] == null ? '' : v[f];
    });
    box.querySelectorAll('[data-act="quickSet"]').forEach(b => {
      const on = v[b.dataset.f] === b.dataset.v;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
    });
    const star = $('#qStar');
    star.textContent = v.star ? '★ Today' : '☆ Today';
    star.classList.toggle('on', v.star);
    $('#qWaiting').classList.toggle('show', v.status === 'waiting');
    $('#quickInput').placeholder = tpl ? tpl.title : 'Task name, e.g. Monthly report fri !high #clinic';
    $('#qSubs').innerHTML = v.subtasks.map((name, i) => `<div class="qsub"><span>${esc(name)}</span><button type="button" class="iconbtn" data-act="quickDelSub" data-i="${i}" aria-label="Remove ${esc(name)}">✕</button></div>`).join('');
    $('#qClientNew').textContent = v.clientTag.trim() && !C.findClient(app.data.clients, v.clientTag) ? 'New client. It will be saved to your list.' : '';
    $('#qSpentNote').textContent = v.spentBad ? 'Try a time like 1h 20m or 45m.' : '';
  }
  function refreshQuick() {
    const input = $('#quickInput');
    if (!input) return;
    if (!input.value.trim()) quick.ignore = [];
    const { parsed, tpl, v } = quickNow();
    const u = quick.user;
    const overridden = { priority: u.priority !== undefined, date: u.due !== undefined, time: u.dueTime !== undefined, client: u.clientTag !== undefined };
    $('#quickChips').innerHTML = parsed.chips.filter(c => !overridden[c.kind]).map(c => `<button type="button" class="chip-x ${c.kind}" data-act="quickChip" data-kind="${c.kind}" title="Remove, and keep these words in the name">${esc(c.label)} ✕</button>`).join('');
    const val = input.value;
    const tok = val.match(/(?:^|\s)#([^\s#]*)$/);
    let items = [];
    if (tok) {
      const q = tok[1].toLowerCase();
      items = app.clientNames().filter(x => x.toLowerCase().includes(q)).slice(0, 6).map(x => ({ label: x, insert: `#${x}`, kind: 'tag' }));
    } else if (/^\/\S*$/.test(val)) {
      const q = val.slice(1).toLowerCase();
      items = app.data.templates.filter(x => x.name.toLowerCase().includes(q)).slice(0, 6).map(x => ({ label: x.name, insert: `/${x.name}`, kind: 'tpl' }));
    }
    quick.items = items;
    $('#quickSuggest').innerHTML = items.map((x, i) => `<button type="button" class="pill" data-act="quickPick" data-i="${i}">${esc(x.label)}</button>`).join('');
    showQuickFields(v, tpl);
  }
  function applySuggestion(item) {
    const input = $('#quickInput');
    input.value = item.kind === 'tag' ? input.value.replace(/#[^\s#]*$/, item.insert + ' ') : item.insert + ' ';
    input.focus();
    refreshQuick();
  }
  app.actions.quickPick = el => applySuggestion(quick.items[Number(el.dataset.i)]);
  app.actions.quickChip = el => { quick.ignore.push(el.dataset.kind); $('#quickInput').focus(); refreshQuick(); };
  app.actions.quickSet = el => { quick.user[el.dataset.f] = el.dataset.v; refreshQuick(); };
  app.actions.quickStar = () => { quick.user.star = !quick.user.star; refreshQuick(); };
  app.actions.quickDelSub = el => {
    const { v } = quickNow(), name = v.subtasks[Number(el.dataset.i)], u = quick.user;
    const at = u.addedSubs.lastIndexOf(name);
    if (at >= 0) u.addedSubs.splice(at, 1);
    else u.removedSubs.push(name);
    refreshQuick();
  };
  /* Choosing from the list replaces a template named in the task name. */
  function pickTemplate(id) {
    const input = $('#quickInput'), { parsed } = quickNow();
    if (parsed.templateId) {
      const named = app.data.templates.find(t => t.id === parsed.templateId);
      input.value = input.value.trim().slice(1 + named.name.length).trim();
    }
    quick.pickedTpl = id;
    quick.user.removedSubs = [];
    refreshQuick();
  }
  function addQuickSub() {
    const box = $('#qAddSub'), name = box.value.trim();
    if (name) quick.user.addedSubs.push(name);
    box.value = '';
    return !!name;
  }
  const shake = el => { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); el.focus(); };
  function createFromQuick(mode) {
    addQuickSub();
    const input = $('#quickInput');
    const { v } = quickNow();
    if (!v.title.trim()) { shake(input); return; }
    if (v.spentBad) { showQuickFields(v, null); shake($('[data-q="spent"]')); return; }
    app.remember('Add task');
    const t = C.taskFromQuick(v, { ownerId: app.data.owner.id, now: new Date() });
    t.clientTag = app.rememberClient(t.clientTag);
    app.data.tasks.push(t);
    const asTemplate = $('#qSaveTpl').checked;
    if (asTemplate) { t.templatePrompted = true; saveTemplate(t); }
    C.rankFirst(app.tasks(), t);
    t.z = ++z;
    if (app.ui.tab !== 'board') { app.ui.tab = 'board'; $('#view').innerHTML = ''; }
    if (mode === 'another') {
      input.value = '';
      quick.ignore = [];
      quick.user = freshUser();
      quick.pickedTpl = '';
      $('#qSaveTpl').checked = false;
      fillQuickLists();
      if (document.activeElement && document.activeElement.matches('.quick [data-q]')) document.activeElement.blur();
      refreshQuick();
      app.commit();
      input.focus();
    } else {
      app.closeQuickAdd();
      app.commit();
      if (mode === 'open') openPanel(t.id);
    }
    app.ui.selectedId = t.id;
    app.announceNew(t);
    if (v.startTimer) app.toggleTimer(t.id);
    if (asTemplate) app.toast(`Template saved: ${t.title}`, { ms: 3000 });
    if (mode !== 'open') maybeOfferTemplate(t);
  }
  app.actions.quickCreate = el => createFromQuick(el.dataset.mode);
  /* Adds a task from a plain text box in the list or columns view. */
  app.createFromText = function (text, fields) {
    const p = C.parseQuickAdd(text, { today: app.today(), now: new Date(), clientTags: app.clientNames(), templates: app.data.templates });
    const tpl = p.templateId ? app.data.templates.find(x => x.id === p.templateId) : null;
    if (!p.title && !tpl) return false;
    const parts = { due: p.due, dueTime: p.dueTime, ...(fields || {}), ...(p.title ? { title: p.title } : {}), ...(p.priority ? { priority: p.priority } : {}), ...(p.clientTag ? { clientTag: p.clientTag } : {}) };
    app.remember('Add task');
    let t;
    if (tpl) { t = C.taskFromTemplate(tpl, { ownerId: app.data.owner.id, ...parts }); app.data.tasks.push(t); }
    else t = app.createTask(parts);
    t.clientTag = app.rememberClient(t.clientTag);
    C.rankFirst(app.tasks(), t);
    t.z = ++z;
    app.commit();
    app.announceNew(t);
    return true;
  };
  document.addEventListener('input', ev => {
    if (ev.target.id === 'quickInput') { refreshQuick(); return; }
    const f = ev.target.dataset && ev.target.dataset.q;
    if (!f || !ev.target.closest('.quick')) return;
    if (f === 'template') { pickTemplate(ev.target.value); return; }
    if (f === 'startTimer') quick.user.startTimer = ev.target.checked;
    else if (f === 'due' || f === 'start' || f === 'dueTime') {
      quick.user[f] = ev.target.value || null;
      if (f === 'due' && !ev.target.value) quick.user.dueTime = null;
      if (f === 'dueTime' && ev.target.value && !quickNow().v.due) quick.user.due = app.today();
    }
    else quick.user[f] = ev.target.value;
    refreshQuick();
  });
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Enter' || !ev.target.closest || !ev.target.closest('.quick')) {
      if (ev.key === 'Tab' && ev.target.id === 'quickInput' && !ev.shiftKey && quick.items && quick.items.length) {
        ev.preventDefault();
        applySuggestion(quick.items[0]);
      }
      return;
    }
    if (ev.ctrlKey || ev.metaKey) { ev.preventDefault(); createFromQuick('open'); return; }
    if (ev.target.matches('button,select,textarea')) return;
    ev.preventDefault();
    if (ev.target.id === 'qAddSub' && addQuickSub()) { refreshQuick(); return; }
    createFromQuick(ev.shiftKey ? 'another' : 'plain');
  });
})(window);
