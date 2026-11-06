/* Selecting several tasks at once, and the bar that changes them together. */
(function (root) {
  'use strict';
  const C = root.TMCore, app = root.TMApp;
  const $ = app.$, esc = C.esc;
  const picked = new Set();

  app.isPicked = id => picked.has(id);
  app.pickedTasks = () => [...picked].map(app.task).filter(Boolean);
  app.togglePick = id => {
    if (picked.has(id)) picked.delete(id); else picked.add(id);
    app.syncPicks();
  };
  app.addPicks = ids => { ids.forEach(id => picked.add(id)); app.syncPicks(); };
  app.clearPicks = () => {
    if (!picked.size) return false;
    picked.clear();
    app.syncPicks();
    return true;
  };

  /* Marks the chosen tasks in whichever view is showing, and draws the bar. */
  app.syncPicks = function () {
    for (const id of [...picked]) if (!app.task(id)) picked.delete(id);
    document.querySelectorAll('#view [data-note], #view [data-taskel]').forEach(el => {
      el.classList.toggle('picked', picked.has(el.dataset.note || el.dataset.taskel));
    });
    drawBar();
  };
  function drawBar() {
    const host = $('#bulkBar');
    if (!host) return;
    const list = app.pickedTasks();
    if (!list.length || app.ui.tab !== 'board') { host.classList.remove('open'); host.innerHTML = ''; return; }
    host.classList.add('open');
    const count = host.querySelector('.bulk-count');
    if (count && host.contains(document.activeElement) && document.activeElement.matches('input')) { count.textContent = `${list.length} selected`; return; }
    const allStarred = list.every(t => t.star);
    const tags = app.clientNames();
    host.innerHTML = `<b class="bulk-count">${list.length} selected</b>
      <span class="bulk-seg" role="group" aria-label="Priority">${C.PRIORITIES.map(p => `<button data-act="bulkPriority" data-v="${p}">${C.PRIORITY_LABEL[p]}</button>`).join('')}</span>
      <span class="dots" role="group" aria-label="Colour">${Object.entries(C.COLORS).map(([k, v]) => `<button style="background:${v}" data-act="bulkColor" data-c="${k}" aria-label="Make them ${k}" title="${k}"></button>`).join('')}</span>
      <label class="bulk-field"><span>Due</span><input type="date" id="bulkDue" aria-label="Due date for all selected"></label>
      <label class="bulk-field"><span>Client</span><input id="bulkClient" list="bulkTags" placeholder="Name" aria-label="Client for all selected"><datalist id="bulkTags">${tags.map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
      <button class="bulk-btn" data-act="bulkStar" title="${allStarred ? 'Remove from' : 'Add to'} Today">${allStarred ? '★' : '☆'} Today</button>
      <button class="bulk-btn go" data-act="bulkDone">✓ Done</button>
      <button class="bulk-btn" data-act="bulkDelete">Delete</button>
      <button class="bulk-x" data-act="bulkClear" aria-label="Clear selection" title="Clear selection (Esc)">✕</button>`;
  }

  const plural = n => `${n} task${n === 1 ? '' : 's'}`;
  function changeAll(label, fn, toast) {
    const list = app.pickedTasks(), now = new Date().toISOString();
    if (!list.length) return;
    app.change(label, () => { for (const t of list) { fn(t); t.updatedAt = now; } }, { toast: toast(list.length) });
  }
  app.actions.bulkPriority = el => changeAll('Change priority', t => { t.priority = el.dataset.v; }, n => `${plural(n)} set to ${C.PRIORITY_LABEL[el.dataset.v]}`);
  app.actions.bulkColor = el => changeAll('Change colour', t => { t.color = el.dataset.c; }, n => `${plural(n)} recoloured`);
  app.actions.bulkStar = () => {
    const star = !app.pickedTasks().every(t => t.star);
    changeAll(star ? 'Add to Today' : 'Remove from Today', t => { t.star = star; }, n => `${plural(n)} ${star ? 'added to' : 'removed from'} Today`);
  };
  app.actions.bulkDone = () => {
    const list = app.pickedTasks();
    picked.clear();
    app.finishMany(list);
  };
  app.actions.bulkClear = () => app.clearPicks();
  app.actions.bulkDelete = () => {
    const n = picked.size;
    app.openModal(`<h2>Delete ${plural(n)}?</h2><p>You can undo this until you close Taskmaster.</p><div class="modal-acts"><button class="btn" data-act="closeModal">Cancel</button><button class="btn primary danger-fill" data-act="bulkDeleteYes">Delete</button></div>`);
  };
  app.actions.bulkDeleteYes = () => {
    const list = app.pickedTasks(), n = list.length;
    app.closeModal();
    picked.clear();
    if (list.some(t => t.id === app.ui.panelId)) app.ui.panelId = null;
    app.fx.sound('remove');
    list.slice(0, 12).forEach(t => app.fx.poof(app.fx.lift(app.taskEl(t.id))));
    app.change('Delete tasks', () => {
      const ids = new Set(list.map(t => t.id));
      list.forEach(t => C.pauseTimer(t, new Date()));
      app.data.tasks = app.data.tasks.filter(t => !ids.has(t.id));
    }, { toast: `Deleted ${plural(n)}` });
  };
  document.addEventListener('change', ev => {
    if (ev.target.id === 'bulkDue') {
      const v = ev.target.value || null;
      ev.target.blur();
      changeAll('Change due date', t => { t.due = v; if (v) t.recurrenceAnchorDay = Number(v.slice(8)); else t.dueTime = null; }, n => (v ? `${plural(n)} due ${C.fmtDay(v)}` : `Due date removed from ${plural(n)}`));
    }
    if (ev.target.id === 'bulkClient') {
      const v = app.rememberClient(ev.target.value);
      ev.target.blur();
      changeAll('Change client', t => { t.clientTag = v; }, n => (v ? `${plural(n)} tagged ${v}` : `Client removed from ${plural(n)}`));
    }
  });
  /* Everything showing that can be selected, for Ctrl + A. */
  app.pickAllShowing = function () {
    const found = document.querySelectorAll('#view [data-note], #view [data-taskel]');
    const ids = [...found].filter(el => el.offsetWidth && !el.classList.contains('dim')).map(el => el.dataset.note || el.dataset.taskel);
    app.addPicks(ids);
  };

  /* Shift or Ctrl + click in the list and columns. Notes on the board handle this as they're dragged. */
  const pickTarget = ev => {
    const el = ev.target.closest && ev.target.closest('#listView [data-row], #columnsView [data-card]');
    return el && !ev.target.closest('button,input,label,a') ? el : null;
  };
  document.addEventListener('mousedown', ev => { if ((ev.shiftKey || ev.ctrlKey || ev.metaKey) && pickTarget(ev)) ev.preventDefault(); });
  document.addEventListener('click', ev => {
    const el = pickTarget(ev);
    if (!el) return;
    if (ev.shiftKey || ev.ctrlKey || ev.metaKey) {
      ev.stopPropagation();
      ev.preventDefault();
      app.togglePick(el.dataset.row || el.dataset.card);
    } else app.clearPicks();
  }, true);
})(window);
