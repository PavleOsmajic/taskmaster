/* The two other task views: a normal to-do list, and Trello-style columns. */
(function (root) {
  'use strict';
  const C = root.TMCore, app = root.TMApp;
  const $ = app.$, esc = C.esc;

  const paper = t => (t.color === 'white' ? '#d9dcdf' : C.COLORS[t.color]);
  const visible = () => app.tasks().filter(app.matchesFilters);
  const expanded = new Set();

  /* Keeps a half-typed task and the cursor in place when the view redraws. */
  function redraw(host, html) {
    const active = document.activeElement;
    const focusId = active && host.contains(active) && active.dataset.addtask ? active.dataset.addtask : null;
    const caret = focusId ? active.selectionStart : 0;
    const typed = {};
    host.querySelectorAll('[data-addtask]').forEach(i => { typed[i.dataset.addtask] = i.value; });
    const scrolls = {};
    host.querySelectorAll('[data-scrollkey]').forEach(n => { scrolls[n.dataset.scrollkey] = n.scrollTop; });
    host.innerHTML = html;
    host.querySelectorAll('[data-addtask]').forEach(i => { if (typed[i.dataset.addtask]) i.value = typed[i.dataset.addtask]; });
    host.querySelectorAll('[data-scrollkey]').forEach(n => { n.scrollTop = scrolls[n.dataset.scrollkey] || 0; });
    if (focusId) {
      const again = host.querySelector(`[data-addtask="${focusId}"]`);
      if (again) { again.focus(); again.setSelectionRange(caret, caret); }
    }
  }
  const timerButton = t => (C.isDone(t) ? '' : `<button class="play" data-act="timer" data-id="${esc(t.id)}" aria-label="${t.timerStartedAt ? 'Pause' : 'Start'} timer" title="${t.timerStartedAt ? 'Pause' : 'Start'} timer">${t.timerStartedAt ? '❚❚' : '▶'}</button>`);
  const starButton = t => `<button class="mini star ${t.star ? 'is' : ''}" data-act="star" data-id="${esc(t.id)}" aria-label="${t.star ? 'Remove from' : 'Add to'} today" aria-pressed="${t.star}" title="Today">${t.star ? '★' : '☆'}</button>`;
  const checkButton = t => `<button class="mini check ${C.isDone(t) ? 'is' : ''}" data-act="toggleDone" data-id="${esc(t.id)}" aria-label="${C.isDone(t) ? 'Reopen' : 'Mark as done'}" title="${C.isDone(t) ? 'Reopen' : 'Mark as done'}">✓</button>`;
  const spent = t => app.spentHTML(t);
  const subCount = t => (t.subtasks.length ? `${t.subtasks.filter(s => s.done).length} of ${t.subtasks.length}` : '');

  /* ---------- list ---------- */
  function rowHTML(t) {
    const due = C.dueLabel(t, app.today(), new Date());
    const tag = app.tagLine(t);
    const open = expanded.has(t.id);
    return `<div class="lrow ${esc(t.priority)} ${t.timerStartedAt ? 'on' : ''}" data-taskel="${esc(t.id)}" data-row="${esc(t.id)}" tabindex="0" aria-label="${esc(t.title)}">
      <div class="lline" data-act="openPanel" data-id="${esc(t.id)}" style="--c:${paper(t)}">
        ${app.prefs().listSort === 'order' ? '<span class="lgrip" aria-hidden="true" title="Drag to move">⠿</span>' : ''}
        ${checkButton(t)}
        ${t.subtasks.length ? `<button class="lchev ${open ? 'open' : ''}" data-act="toggleExpand" data-id="${esc(t.id)}" aria-expanded="${open}" aria-label="Show subtasks">›</button>` : '<span class="lchev none"></span>'}
        <span class="lmain"><span class="ltitle">${esc(t.title)}</span>${tag ? `<span class="ltag">${esc(tag)}</span>` : ''}<span class="added">${esc(C.addedLabel(t, app.today()))}</span></span>
        ${t.subtasks.length ? `<span class="lcount">${subCount(t)}</span>` : ''}
        ${C.priorityBadge(t)}
        <span class="due ${due.kind}" data-due="${esc(t.id)}">${esc(due.text)}</span>
        <span class="ltime">${timerButton(t)}${spent(t)}</span>
        ${starButton(t)}
      </div>
      ${open ? `<div class="lsubs">${t.subtasks.map(s => `<label class="${s.done ? 'd' : ''}"><input type="checkbox" data-subtick="${esc(s.id)}" data-task="${esc(t.id)}" ${s.done ? 'checked' : ''}><span>${esc(s.name)}</span></label>`).join('')}</div>` : ''}
    </div>`;
  }
  app.renderList = function () {
    const host = $('#listView');
    if (!host) return;
    const myOrder = app.prefs().listSort === 'order';
    const filtering = app.ui.search.trim() || app.ui.colorFilter || app.ui.focus;
    const shown = visible();
    let body;
    if (myOrder) {
      const rows = C.listOrder(shown);
      body = rows.length ? `<section class="lgroup lflat" id="listRows">${rows.map(rowHTML).join('')}</section>` : '';
    } else {
      body = C.listGroups(shown, app.today()).map(g => `<section class="lgroup"><h2 class="${g.key === 'overdue' ? 'late' : ''}">${esc(g.label)} <span>${g.items.length}</span></h2>${g.items.map(rowHTML).join('')}</section>`).join('');
    }
    if (!body) body = `<div class="empty inline"><h2>${filtering ? 'Nothing matches' : 'All clear'}</h2><p>${filtering ? 'Try clearing the search, colour or Today filter.' : 'Add your first task above.'}</p></div>`;
    redraw(host, `<div class="llist" data-scrollkey="list"><div class="lwrap">
      <div class="ltop"><input class="ladd" data-addtask="list" autocomplete="off" placeholder="Add a task, e.g. Monthly report fri !high #clinic" aria-label="Add a task">
      <span class="seg" role="group" aria-label="List order">${[['order', 'My order'], ['date', 'By date']].map(([k, l]) => `<button class="${app.prefs().listSort === k ? 'on' : ''}" data-act="listSort" data-v="${k}" aria-pressed="${app.prefs().listSort === k}">${l}</button>`).join('')}</span></div>
      ${body}</div></div>`);
  };
  app.actions.listSort = el => { app.prefs().listSort = el.dataset.v; app.commit(); };
  app.actions.toggleExpand = el => {
    const id = el.dataset.id;
    if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
    app.renderList();
  };

  /* ---------- columns ---------- */
  function cardHTML(t) {
    const due = C.dueLabel(t, app.today(), new Date());
    const tag = app.tagLine(t);
    const doneCount = t.subtasks.filter(s => s.done).length;
    const pct = t.subtasks.length ? Math.round(doneCount / t.subtasks.length * 100) : 0;
    return `<article class="kcard ${esc(t.priority)} ${C.isDone(t) ? 'done' : ''} ${t.timerStartedAt ? 'on' : ''}" data-taskel="${esc(t.id)}" data-card="${esc(t.id)}" data-act="openPanel" data-id="${esc(t.id)}" style="--c:${paper(t)}" tabindex="0" aria-label="${esc(t.title)}">
      <div class="khead">${C.priorityBadge(t)}${t.due || !C.isDone(t) ? `<span class="due ${due.kind}" data-due="${esc(t.id)}">${esc(due.text)}</span>` : ''}</div>
      <h3>${esc(t.title)}</h3>
      ${tag ? `<div class="ktag">${esc(tag)}</div>` : ''}
      <div class="added">${esc(C.addedLabel(t, app.today()))}</div>
      ${t.subtasks.length ? `<div class="kprog"><div class="prog"><i style="width:${pct}%"></i></div><span>${subCount(t)}</span></div>` : ''}
      <div class="kfoot">${timerButton(t)}${spent(t)}<span class="sp"></span>${C.isDone(t) ? '' : starButton(t)}${checkButton(t)}</div>
    </article>`;
  }
  app.renderColumns = function () {
    const host = $('#columnsView');
    if (!host) return;
    const cols = C.columnGroups(visible(), app.today());
    redraw(host, `<div class="kcols">${cols.map(c => `<section class="kcol" data-col="${c.key}" ${c.key === 'done' ? 'id="doneCol"' : ''}>
        <h2>${esc(c.label)} <span>${c.items.length}</span></h2>
        <div class="kbody" data-scrollkey="col-${c.key}">${c.items.map(cardHTML).join('') || `<p class="kempty">${c.key === 'done' ? 'Finished tasks land here today, then stay in the Done tray.' : 'Drag a card here.'}</p>`}</div>
        ${c.key === 'done'
          ? `<button class="linkbtn kmore" data-act="toggleTray">Open Done tray (${app.tasks().filter(t => C.isDone(t)).length})</button>`
          : `<input class="kadd" data-addtask="${c.key}" autocomplete="off" placeholder="+ Add a task" aria-label="Add a task to ${esc(c.label)}">`}
      </section>`).join('')}</div>`);
  };

  /* ---------- adding from the list or a column ---------- */
  document.addEventListener('keydown', ev => {
    const where = ev.target.dataset && ev.target.dataset.addtask;
    if (!where || ev.key !== 'Enter') return;
    ev.preventDefault();
    const fields = where === 'waiting' ? { status: 'waiting' } : {};
    if (app.createFromText(ev.target.value, fields)) {
      ev.target.value = '';
      const again = document.querySelector(`[data-addtask="${where}"]`);
      if (again) { again.value = ''; again.focus(); }
    }
  });

  document.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && ev.target.dataset && ev.target.dataset.card) { ev.preventDefault(); app.openPanel(ev.target.dataset.card); }
  });

  /* ---------- moving list rows ---------- */
  function saveRowOrder(id, beforeId, afterId) {
    const everyone = C.listOrder(app.tasks()).map(t => t.id);
    const next = C.reorderIds(everyone, id, beforeId, afterId);
    if (next.join() === everyone.join() && Number.isFinite(app.task(id).listRank)) return;
    app.change('Move task', () => {
      next.forEach((rowId, i) => { app.task(rowId).listRank = i; });
      app.task(id).updatedAt = new Date().toISOString();
    });
    app.fx.sound('tick');
  }
  document.addEventListener('pointerdown', ev => {
    const row = ev.target.closest && ev.target.closest('#listRows [data-row]');
    if (!row || ev.button !== 0 || ev.target.closest('button,input,label,a')) return;
    const id = row.dataset.row, host = $('#listRows'), scroller = row.closest('.llist');
    const sx = ev.clientX, sy = ev.clientY, r = row.getBoundingClientRect(), oy = sy - r.top;
    let ghost = null, place = null, lastY = sy, raf = 0, before = null;
    const others = () => [...host.querySelectorAll('[data-row]')].filter(n => n !== row);
    const position = y => {
      lastY = y;
      ghost.style.top = y - oy + 'px';
      before = others().find(n => { const b = n.getBoundingClientRect(); return y < b.top + b.height / 2; }) || null;
      host.insertBefore(place, before);
    };
    /* Scrolls the list while a row is held near its top or bottom edge. */
    const autoScroll = () => {
      const box = scroller.getBoundingClientRect(), edge = 56;
      const speed = lastY < box.top + edge ? -9 : lastY > box.bottom - edge ? 9 : 0;
      if (speed) { scroller.scrollTop += speed; position(lastY); }
      raf = requestAnimationFrame(autoScroll);
    };
    const move = e => {
      if (!ghost && Math.hypot(e.clientX - sx, e.clientY - sy) < 5) return;
      if (!ghost) {
        ghost = row.cloneNode(true);
        ghost.classList.add('lghost');
        ghost.style.left = r.left + 'px';
        ghost.style.width = r.width + 'px';
        document.body.appendChild(ghost);
        place = document.createElement('div');
        place.className = 'kplace';
        place.style.height = r.height + 'px';
        row.style.display = 'none';
        document.body.classList.add('dragging-card');
        raf = requestAnimationFrame(autoScroll);
      }
      position(e.clientY);
    };
    const up = e => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      if (!ghost) return;
      cancelAnimationFrame(raf);
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      ghost.remove();
      place.remove();
      row.style.display = '';
      document.body.classList.remove('dragging-card');
      if (e.type === 'pointercancel') return;
      const shown = others();
      saveRowOrder(id, before ? before.dataset.row : null, before ? null : (shown.length ? shown[shown.length - 1].dataset.row : null));
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  });
  document.addEventListener('keydown', ev => {
    const row = ev.target.dataset && ev.target.dataset.row ? ev.target : null;
    if (!row) return;
    if (ev.key === 'Enter') { ev.preventDefault(); app.openPanel(row.dataset.row); return; }
    if (!ev.altKey || !['ArrowUp', 'ArrowDown'].includes(ev.key) || app.prefs().listSort !== 'order') return;
    ev.preventDefault();
    const id = row.dataset.row;
    const shown = [...document.querySelectorAll('#listRows [data-row]')].map(n => n.dataset.row);
    const at = shown.indexOf(id);
    if (ev.key === 'ArrowUp' && at > 0) saveRowOrder(id, shown[at - 1], null);
    if (ev.key === 'ArrowDown' && at < shown.length - 1) saveRowOrder(id, shown[at + 2] || null, shown[at + 2] ? null : shown[at + 1]);
    const again = document.querySelector(`#listRows [data-row="${CSS.escape(id)}"]`);
    if (again) again.focus();
  });

  /* ---------- dragging cards ---------- */
  let suppressClick = false;
  document.addEventListener('click', ev => {
    if (suppressClick) { suppressClick = false; ev.stopPropagation(); ev.preventDefault(); }
  }, true);
  document.addEventListener('pointerdown', ev => {
    const card = ev.target.closest && ev.target.closest('[data-card]');
    if (!card || ev.button !== 0 || ev.target.closest('button,input,label,a')) return;
    const id = card.dataset.card, sx = ev.clientX, sy = ev.clientY;
    const r = card.getBoundingClientRect();
    const ox = sx - r.left, oy = sy - r.top;
    let ghost = null, place = null, target = null;
    const move = e => {
      if (!ghost && Math.hypot(e.clientX - sx, e.clientY - sy) < 5) return;
      if (!ghost) {
        ghost = card.cloneNode(true);
        ghost.classList.add('kghost');
        ghost.style.width = r.width + 'px';
        document.body.appendChild(ghost);
        place = document.createElement('div');
        place.className = 'kplace';
        place.style.height = r.height + 'px';
        card.classList.add('kdragging');
        document.body.classList.add('dragging-card');
      }
      ghost.style.left = e.clientX - ox + 'px';
      ghost.style.top = e.clientY - oy + 'px';
      const col = document.elementsFromPoint(e.clientX, e.clientY).map(n => n.closest && n.closest('[data-col]')).find(Boolean);
      if (!col) { if (place.parentNode) place.remove(); target = null; return; }
      const body = col.querySelector('.kbody');
      const cards = [...body.querySelectorAll('[data-card]')].filter(c => c !== card);
      const before = cards.find(c => { const b = c.getBoundingClientRect(); return e.clientY < b.top + b.height / 2; });
      body.insertBefore(place, before || null);
      target = { key: col.dataset.col, index: before ? cards.indexOf(before) : cards.length, order: cards.map(c => c.dataset.card) };
    };
    const up = e => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      if (!ghost) return;
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      ghost.remove();
      if (place.parentNode) place.remove();
      card.classList.remove('kdragging');
      document.body.classList.remove('dragging-card');
      if (e.type !== 'pointercancel' && target) dropCard(id, target, e);
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  });
  function dropCard(id, target, ev) {
    const t = app.task(id);
    if (!t) return;
    if (target.key === 'done') {
      if (!C.isDone(t)) { app.finish(t, { at: [ev.clientX, ev.clientY] }); }
      return;
    }
    const wasDone = C.isDone(t);
    app.change(wasDone ? 'Reopen task' : 'Move card', () => {
      if (wasDone) app.setDone(t, false);
      t.status = target.key;
      C.moveInOrder(target.order, id, target.index).forEach((cardId, i) => {
        const c = app.task(cardId);
        if (c) c.rank = i;
      });
      t.updatedAt = new Date().toISOString();
    }, wasDone ? { toast: `Reopened: ${t.title}` } : undefined);
    if (wasDone) app.fx.sound('restore');
  }
})(window);
