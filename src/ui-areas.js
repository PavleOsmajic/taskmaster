/* Areas: labelled parts of the board, such as one for each client. */
(function (root) {
  'use strict';
  const C = root.TMCore, app = root.TMApp;
  const $ = app.$, esc = C.esc;

  const areas = () => app.data.areas;
  const area = id => areas().find(a => a.id === id);
  const areaEl = id => $(`#world [data-area="${CSS.escape(id)}"]`);
  const heightOf = id => { const el = app.noteEl(id); return el ? el.offsetHeight : 205; };
  const widthOf = id => C.noteWidth(app.task(id));

  function areaHTML(a) {
    return `<section class="area" data-area="${esc(a.id)}" style="left:${a.x}px;top:${a.y}px;width:${a.w}px;height:${a.h}px">
      <div class="area-head" title="Drag to move this area and its notes">
        <span class="area-move" aria-hidden="true">⠿</span>
        <input class="area-name" data-area-name="${esc(a.id)}" list="areaTags" value="${esc(a.name)}" size="${Math.max(16, a.name.length + 2)}" placeholder="Client or group name" aria-label="Area name">
        <span class="sp"></span>
        <button class="iconbtn" data-act="deleteArea" data-id="${esc(a.id)}" aria-label="Delete area" title="Delete this area. Its notes stay on the board.">✕</button>
      </div>
      <span class="area-grip" data-area-grip title="Drag to resize" aria-hidden="true"></span>
    </section>`;
  }
  app.areasHTML = () => `<datalist id="areaTags">${app.clientNames().map(x => `<option value="${esc(x)}">`).join('')}</datalist>${areas().map(areaHTML).join('')}`;
  app.areaRects = () => areas().map(a => ({ x: a.x, y: a.y, w: a.w, h: a.h }));

  /* ---------- creating and removing ---------- */
  app.actions.newArea = () => {
    const view = app.visibleWorld(), size = { w: 928, h: 360 };
    const rects = [...app.noteRects(), ...app.areaRects()];
    const at = C.findFreeSpot(rects, { x: view.x, y: view.y, w: Math.max(view.w, size.w + 40), h: 20000 }, size);
    const a = C.newArea({ ownerId: app.data.owner.id, ...at, ...size });
    app.change('Add area', () => areas().push(a));
    app.showWorldRect(a);
    app.fx.sound('create');
    const input = $(`[data-area-name="${CSS.escape(a.id)}"]`);
    if (input) input.focus();
  };
  app.actions.deleteArea = el => {
    const a = area(el.dataset.id);
    if (!a) return;
    app.change('Delete area', () => { app.data.areas = areas().filter(x => x !== a); }, { toast: `Area deleted${a.name ? `: ${a.name}` : ''}. Its notes stay on the board.` });
  };
  app.actions.clientAreas = () => {
    const list = app.boardTasks();
    if (!list.some(t => (t.clientTag || '').trim())) {
      app.toast('No notes have a client yet. Add one with #name, or in a note\'s details.', { ms: 5000 });
      return;
    }
    const view = app.visibleWorld();
    const base = C.assignAreas(list, areas(), heightOf, widthOf);
    const made = C.clientAreas(list, areas(), { x: view.x + 24, y: view.y + 20, w: view.w - 48, ownerId: app.data.owner.id });
    const result = C.tidyBoard(list, made.areas, heightOf, widthOf, { x: view.x + 24, y: view.y + 20, w: Math.max(C.NOTE_W, view.w - 48) }, { ...base, ...made.assign });
    app.change('Make client areas', () => {
      app.data.areas = result.areas;
      for (const t of list) t.position = result.positions[t.id];
    }, { toast: made.created ? `Made ${made.created} client area${made.created === 1 ? '' : 's'}` : 'Notes moved into their client areas' });
    requestAnimationFrame(() => app.fitAll());
  };
  /* Tidies inside each area, and everything else below them. */
  app.tidyWithAreas = function (list, frame) {
    const assign = C.assignAreas(list, areas(), heightOf, widthOf);
    const result = C.tidyBoard(list, areas(), heightOf, widthOf, frame, assign);
    app.change('Tidy up', () => {
      app.data.areas = result.areas;
      for (const t of list) t.position = result.positions[t.id];
    }, { toast: 'Notes tidied' });
  };

  /* ---------- where notes land ---------- */
  /* Where a new note with this client should look for space, if it has an area. */
  app.spotInClientArea = function (t, rects, size) {
    const a = C.areaForClient(areas(), t.clientTag);
    if (!a) return null;
    const at = C.findFreeSpot(rects, { x: a.x, y: a.y + C.AREA_HEAD - 20, w: a.w, h: 20000 }, size);
    fitArea(a, { ...at, ...size });
    return at;
  };
  function fitArea(a, rect) {
    const next = C.grownArea(a, rect);
    if (next.w === a.w && next.h === a.h) return;
    a.w = next.w;
    a.h = next.h;
    const el = areaEl(a.id);
    if (el) { el.style.width = a.w + 'px'; el.style.height = a.h + 'px'; }
  }
  /* A note dropped in an area, even at its edge, ends up fully inside. */
  app.fitNoteInArea = function (t) {
    const w = widthOf(t.id), h = heightOf(t.id);
    const a = C.areaAt(areas(), t.position.x + w / 2, t.position.y + h / 2);
    if (a) fitArea(a, { x: t.position.x, y: t.position.y, w, h });
  };
  app.showDropArea = function (x, y) {
    let over = null;
    if (x != null) over = document.elementsFromPoint(x, y).map(n => n.closest && n.closest('.area')).find(Boolean) || null;
    document.querySelectorAll('.area.drop').forEach(n => { if (n !== over) n.classList.remove('drop'); });
    if (over) over.classList.add('drop');
  };

  /* ---------- dragging ---------- */
  function track(onMove, onDone) {
    const up = e => {
      removeEventListener('pointermove', onMove); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      onDone(e);
    };
    addEventListener('pointermove', onMove); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }
  /* Moves an area along with the notes inside it. */
  app.moveArea = function (ev, el) {
    ev.preventDefault();
    const a = area(el.dataset.area), zoom = app.prefs().zoom, sx = ev.clientX, sy = ev.clientY;
    const start = { x: a.x, y: a.y };
    const list = app.boardTasks();
    const assign = C.assignAreas(list, areas(), heightOf, widthOf);
    const members = list.filter(t => assign[t.id] === a.id).map(t => ({ t, el: app.noteEl(t.id), x: t.position.x, y: t.position.y }));
    let moved = false;
    el.classList.add('moving-area');
    track(e => {
      const dx = (e.clientX - sx) / zoom, dy = (e.clientY - sy) / zoom;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      moved = true;
      el.style.left = start.x + dx + 'px';
      el.style.top = start.y + dy + 'px';
      for (const m of members) if (m.el) { m.el.style.left = m.x + dx + 'px'; m.el.style.top = m.y + dy + 'px'; }
    }, e => {
      el.classList.remove('moving-area');
      if (!moved) return;
      const dx = Math.round((e.clientX - sx) / zoom), dy = Math.round((e.clientY - sy) / zoom);
      if (e.type === 'pointercancel') { app.render(); return; }
      app.remember('Move area');
      a.x = start.x + dx;
      a.y = start.y + dy;
      for (const m of members) m.t.position = { x: m.x + dx, y: m.y + dy };
      app.scheduleSave();
    });
  };
  app.resizeArea = function (ev, el) {
    ev.preventDefault();
    const a = area(el.dataset.area), zoom = app.prefs().zoom, sx = ev.clientX, sy = ev.clientY;
    const start = { w: a.w, h: a.h };
    let w = a.w, h = a.h, moved = false;
    track(e => {
      moved = true;
      w = Math.round(Math.max(C.AREA_MIN_W, start.w + (e.clientX - sx) / zoom));
      h = Math.round(Math.max(C.AREA_MIN_H, start.h + (e.clientY - sy) / zoom));
      el.style.width = w + 'px';
      el.style.height = h + 'px';
    }, e => {
      if (!moved) return;
      if (e.type === 'pointercancel') { app.render(); return; }
      app.remember('Resize area');
      a.w = w;
      a.h = h;
      app.scheduleSave();
    });
  };

  /* ---------- naming ---------- */
  document.addEventListener('change', ev => {
    const id = ev.target.dataset && ev.target.dataset.areaName;
    if (!id) return;
    const a = area(id), v = ev.target.value.trim();
    if (a && a.name !== v) app.change('Rename area', () => { a.name = v; });
  });
  document.addEventListener('keydown', ev => {
    if (ev.target.dataset && ev.target.dataset.areaName && ev.key === 'Enter') { ev.preventDefault(); ev.target.blur(); }
  });
})(window);
