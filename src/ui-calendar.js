/* The calendar: off, a week strip, or a month panel. Tasks can be dragged to a new day. */
(function (root) {
  'use strict';
  const C = root.TMCore, app = root.TMApp;
  const $ = app.$, esc = C.esc;

  function segHTML(seg) {
    const t = seg.task, today = app.today();
    const cls = [C.isDone(t) ? 'done' : '', C.isOverdue(t, today, new Date()) ? 'late' : '', t.color === 'white' ? 'plain' : '', seg.continuesLeft ? 'cl' : '', seg.continuesRight ? 'cr' : ''].join(' ');
    return `<button class="chip ${cls}" data-chip="${esc(t.id)}" style="grid-column:${seg.col + 1} / span ${seg.span};grid-row:${seg.lane + 1};background:${C.COLORS[t.color]}" title="${esc(t.dueTime ? `${t.dueTime} ${t.title}` : t.title)}">${esc(t.dueTime ? `${t.dueTime} ${t.title}` : t.title)}</button>`;
  }
  function weekRow(days, opts) {
    const today = app.today();
    const segs = C.layoutWeek(days, app.tasks());
    const lanes = segs.reduce((m, s) => Math.max(m, s.lane + 1), 0);
    return `<div class="wrow ${opts.cls || ''}">
      <div class="wcells">${days.map(d => {
        const dn = Number(d.slice(8));
        const outside = opts.month != null && Number(d.slice(5, 7)) !== opts.month;
        return `<div class="wcell ${d === today ? 'today' : ''} ${outside ? 'out' : ''}" data-day="${d}"><span class="dnum">${opts.label ? esc(C.fmtDay(d).replace(/ \w+$/, '')) : dn}${opts.label && d === today ? ' · today' : ''}</span></div>`;
      }).join('')}</div>
      <div class="wsegs" style="grid-template-rows:repeat(${Math.max(lanes, 1)},auto)">${segs.map(segHTML).join('')}</div>
    </div>`;
  }

  function calNav(prevAct, nextAct, title, todayAct) {
    return `<div class="calnav"><button class="iconbtn" data-act="${prevAct}" aria-label="Previous">‹</button><b>${esc(title)}</b><button class="iconbtn" data-act="${nextAct}" aria-label="Next">›</button><button class="btn small" data-act="${todayAct}">Today</button></div>`;
  }
  app.renderCalendar = function () {
    const mode = app.prefs().calendar;
    const week = $('#weekStrip'), month = $('#monthPanel');
    if (!week || !month) return;
    week.classList.toggle('open', mode === 'week');
    month.classList.toggle('open', mode === 'month');
    week.innerHTML = '';
    month.innerHTML = '';
    if (mode === 'week') {
      const start = app.ui.weekCursor || C.weekStart(app.today());
      const days = C.weekDays(start);
      week.innerHTML = calNav('weekPrev', 'weekNext', `${C.fmtDay(days[0]).slice(4)} – ${C.fmtDay(days[6]).slice(4)}`, 'weekToday') + weekRow(days, { cls: 'strip', label: true });
    }
    if (mode === 'month') {
      const cur = app.ui.monthCursor || app.today().slice(0, 7);
      const [y, m] = cur.split('-').map(Number);
      month.innerHTML = calNav('monthPrev', 'monthNext', `${C.MONTH_FULL[m - 1]} ${y}`, 'monthToday') +
        `<div class="mhead">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<span>${d}</span>`).join('')}</div>` +
        `<div class="mgrid">${C.monthGrid(y, m).map(w => weekRow(w, { month: m })).join('')}</div>`;
    }
    // Moving the calendar changes the board's size, so the view needs no other adjustment.
  };
  const shiftWeek = n => { app.ui.weekCursor = C.addDays(app.ui.weekCursor || C.weekStart(app.today()), n); app.renderCalendar(); };
  const shiftMonth = n => {
    const [y, m] = (app.ui.monthCursor || app.today().slice(0, 7)).split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    app.ui.monthCursor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    app.renderCalendar();
  };
  app.actions.weekPrev = () => shiftWeek(-7);
  app.actions.weekNext = () => shiftWeek(7);
  app.actions.weekToday = () => { app.ui.weekCursor = null; app.renderCalendar(); };
  app.actions.monthPrev = () => shiftMonth(-1);
  app.actions.monthNext = () => shiftMonth(1);
  app.actions.monthToday = () => { app.ui.monthCursor = null; app.renderCalendar(); };

  /* ---------- dragging a task to another day ---------- */
  const dayAt = (x, y) => {
    const el = document.elementsFromPoint(x, y).find(n => n.dataset && n.dataset.day);
    return el || null;
  };
  document.addEventListener('pointerdown', ev => {
    const chip = ev.target.closest && ev.target.closest('[data-chip]');
    if (!chip || ev.button !== 0) return;
    ev.preventDefault();
    const id = chip.dataset.chip;
    const grabCell = dayAt(ev.clientX, ev.clientY);
    const grabDay = grabCell && grabCell.dataset.day;
    const sx = ev.clientX, sy = ev.clientY;
    let ghost = null, over = null;
    const move = e => {
      if (!ghost && Math.hypot(e.clientX - sx, e.clientY - sy) < 4) return;
      if (!ghost) {
        ghost = chip.cloneNode(true);
        ghost.classList.add('ghost');
        ghost.style.width = Math.min(chip.offsetWidth, 180) + 'px';
        document.body.appendChild(ghost);
      }
      ghost.style.left = e.clientX + 8 + 'px';
      ghost.style.top = e.clientY + 8 + 'px';
      const cell = dayAt(e.clientX, e.clientY);
      if (over && over !== cell) over.classList.remove('drop');
      if (cell) cell.classList.add('drop');
      over = cell;
    };
    const up = e => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      if (over) over.classList.remove('drop');
      if (!ghost) { app.jumpTo(id); return; }
      ghost.remove();
      const cell = dayAt(e.clientX, e.clientY);
      if (!cell || !grabDay || e.type === 'pointercancel') return;
      const n = C.daysBetween(grabDay, cell.dataset.day);
      if (!n) return;
      const t = app.task(id);
      if (!t) return;
      const next = C.shiftDates(t, n);
      app.change('Change date', () => { t.start = next.start; t.due = next.due; t.updatedAt = new Date().toISOString(); }, { toast: `${t.title} moved to ${C.fmtDay(next.due || next.start)}` });
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  });
})(window);
