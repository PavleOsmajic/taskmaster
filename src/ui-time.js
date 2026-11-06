/* The Time tab: a week of tracked time, ready to copy into Basecamp. */
(function (root) {
  'use strict';
  const C = root.TMCore, app = root.TMApp;
  const $ = app.$, esc = C.esc;
  let lastDays = [];

  const currentWeek = () => app.ui.timeWeek || C.weekStart(app.today());
  function rangeLabel(start) {
    const days = C.weekDays(start);
    return `${C.fmtDay(days[0]).slice(4)} – ${C.fmtDay(days[6]).slice(4)}`;
  }
  app.views.time = function () {
    const p = app.prefs(), start = currentWeek();
    lastDays = C.timeRows(app.tasks(), start, { now: new Date(), rounding: p.rounding });
    const fmt = p.timeFormat;
    const total = lastDays.reduce((a, d) => a + d.total, 0);
    $('#view').innerHTML = `<div class="page">
      <div class="page-band">
        <div class="eyebrow">Time · Week</div>
        <h1>${esc(rangeLabel(start))}</h1>
        <div class="page-tools">
          <span class="calnav"><button class="iconbtn" data-act="timePrev" aria-label="Previous week">‹</button><button class="btn small" data-act="timeNow">This week</button><button class="iconbtn" data-act="timeNext" aria-label="Next week">›</button></span>
          <label class="inline"><span class="lab">Copy as</span><select id="timeFormat"><option value="hm" ${fmt === 'hm' ? 'selected' : ''}>1h 20m</option><option value="decimal" ${fmt === 'decimal' ? 'selected' : ''}>1.33</option></select></label>
          <label class="inline"><span class="lab">Round to</span><select id="timeRounding">${[[0, 'No rounding'], [5, '5 min'], [15, '15 min']].map(([v, l]) => `<option value="${v}" ${Number(p.rounding) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        </div>
      </div>
      <div class="page-body narrow">
        <div class="stats">
          <div class="stat dark"><b>${esc(C.formatDuration(total))}</b><span>tracked this week${C.hoursLabel(total) ? ` (${esc(C.hoursLabel(total))})` : ''}</span></div>
          <div class="stat"><b>${new Set(lastDays.flatMap(d => d.rows.map(r => r.taskId))).size}</b><span>tasks</span></div>
          <div class="stat"><b>${lastDays.reduce((a, d) => a + d.rows.filter(r => !r.logged).length, 0)}</b><span>still to log in Basecamp</span></div>
          <button class="btn primary stat-btn" data-act="copyWeek" ${lastDays.length ? '' : 'disabled'}>Copy week</button>
        </div>
        ${lastDays.length ? lastDays.map((d, di) => `<section class="card">
          <div class="card-head"><h2>${esc(C.fmtDay(d.date))}</h2><span class="sp"></span><b>${esc(C.formatDuration(d.total))}</b><button class="hrsbtn" data-act="copyHours" data-sec="${d.total}" title="Copy these hours for Basecamp">${esc(C.hoursLabel(d.total))}</button><button class="btn small" data-act="copyDay" data-d="${di}">Copy day</button></div>
          ${d.rows.map((r, ri) => `<div class="trow ${r.logged ? 'logged' : ''}">
            <label class="tick" title="Logged in Basecamp"><input type="checkbox" data-log="${di}:${ri}" ${r.logged ? 'checked' : ''} aria-label="Logged in Basecamp"><span>Logged</span></label>
            <button class="linkbtn tname" data-act="openPanel" data-id="${esc(r.taskId)}">${esc(r.title)}</button>
            ${r.clientTag ? `<span class="ttag">${esc(r.clientTag)}</span>` : ''}
            ${!r.logged && r.loggedSeconds ? `<small class="muted">${esc(C.formatDuration(r.loggedSeconds))} logged earlier</small>` : ''}
            ${r.running ? '<small class="live">running</small>' : ''}
            <span class="sp"></span><b class="tval">${esc(C.formatDuration(r.display))}</b><button class="hrsbtn" data-act="copyHours" data-sec="${r.display}" title="Copy these hours for Basecamp">${esc(C.hoursLabel(r.display))}</button>
            <button class="btn small" data-act="editTime" data-id="${esc(r.taskId)}" data-date="${d.date}">Edit</button>
            <button class="btn small" data-act="copyRow" data-r="${di}:${ri}">Copy</button>
          </div>`).join('')}
        </section>`).join('') : '<div class="empty inline"><h2>No time tracked this week</h2><p>Start a timer on any sticky note, and it appears here.</p></div>'}
      </div></div>`;
  };

  async function copy(text, label) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      if (!ok) { app.message('Copy this text', text); return; }
    }
    app.toast(`${label} copied`, { ms: 2500 });
  }
  /* Copies only the number, ready for Basecamp's hours box. */
  app.actions.copyHours = el => {
    const t = el.dataset.id ? app.task(el.dataset.id) : null;
    const secs = t ? C.taskSeconds(t, new Date()) : Number(el.dataset.sec);
    copy(C.formatHours(secs), C.formatHours(secs));
  };
  app.actions.copyWeek = () => copy(C.copyWeek(lastDays, app.prefs().timeFormat), 'Week');
  app.actions.copyDay = el => copy(C.copyDay(lastDays[Number(el.dataset.d)], app.prefs().timeFormat), 'Day');
  app.actions.copyRow = el => {
    const [d, r] = el.dataset.r.split(':').map(Number);
    copy(C.copyRow(lastDays[d].rows[r], app.prefs().timeFormat), 'Row');
  };
  app.actions.timePrev = () => { app.ui.timeWeek = C.addDays(currentWeek(), -7); app.render(); };
  app.actions.timeNext = () => { app.ui.timeWeek = C.addDays(currentWeek(), 7); app.render(); };
  app.actions.timeNow = () => { app.ui.timeWeek = null; app.render(); };
  document.addEventListener('change', ev => {
    if (ev.target.id === 'timeFormat') { app.prefs().timeFormat = ev.target.value; app.commit(); return; }
    if (ev.target.id === 'timeRounding') { app.prefs().rounding = Number(ev.target.value); app.commit(); return; }
    if (ev.target.dataset && ev.target.dataset.log) {
      const [d, r] = ev.target.dataset.log.split(':').map(Number);
      const day = lastDays[d], row = day && day.rows[r], t = row && app.task(row.taskId);
      if (!t) return;
      if (ev.target.checked) t.loggedDays[day.date] = row.seconds;
      else delete t.loggedDays[day.date];
      app.commit();
    }
  });
  /* ---------- correcting tracked time ---------- */
  let editing = null;
  function daySeconds(t, date, now) {
    if (!date) return C.taskSeconds(t, now);
    const tracked = t.timeSessions.filter(s => C.localDate(s.startedAt) === date).reduce((sum, s) => sum + (s.seconds || 0), 0);
    return tracked + (t.timerStartedAt && C.localDate(t.timerStartedAt) === date ? C.runningSeconds(t, now) : 0);
  }
  function editPreview() {
    const out = $('#editPreview'), input = $('#editTimeValue');
    if (!out || !input) return;
    const secs = C.parseTimeEdit(input.value);
    out.classList.toggle('warn', secs === null);
    if (secs === null) { out.textContent = 'Try a time like 15m, 1h 30m or 1.5h.'; return; }
    out.innerHTML = secs ? `This will count as <b>${esc(C.formatDuration(secs))}</b> (${esc(C.formatHours(secs))} h).` : 'This will clear the tracked time.';
  }
  app.actions.editTime = el => {
    const t = app.task(el.dataset.id);
    if (!t) return;
    editing = { id: t.id, date: el.dataset.date || null };
    const secs = daySeconds(t, editing.date, new Date());
    app.openModal(`<h2>Edit tracked <em>time</em></h2>
      <p><b>${esc(t.title)}</b>${editing.date ? ` on ${esc(C.fmtDay(editing.date))}` : ', all days'}. Now ${esc(C.formatDuration(secs))}${C.hoursLabel(secs) ? ` (${esc(C.hoursLabel(secs))})` : ''}.</p>
      <form data-form="editTime"><label class="field"><span>Time really spent</span><input id="editTimeValue" autocomplete="off" value="${esc(C.formatDuration(secs))}" placeholder="e.g. 15m or 1h 30m"></label>
      <p class="small" id="editPreview" role="status"></p>
      ${t.timerStartedAt ? '<p class="small muted">This task\'s timer will stop when you save.</p>' : ''}
      <div class="modal-acts"><button type="button" class="btn" data-act="closeModal">Cancel</button><button class="btn primary">Save</button></div></form>`);
    const input = $('#editTimeValue');
    input.select();
    editPreview();
  };
  document.addEventListener('input', ev => { if (ev.target.id === 'editTimeValue') editPreview(); });
  app.forms.editTime = () => {
    const t = editing && app.task(editing.id), secs = C.parseTimeEdit($('#editTimeValue').value);
    if (!t) { app.closeModal(); return; }
    if (secs === null) { editPreview(); $('#editTimeValue').focus(); return; }
    const { date } = editing, now = new Date();
    app.closeModal();
    app.change('Edit time', () => {
      C.setTrackedTime(t, secs, { date, now });
      t.updatedAt = now.toISOString();
    }, { toast: `${t.title}: now ${C.formatDuration(secs)} (${C.formatHours(secs)} h)` });
    app.renderPanel(true);
  };

  /* Keeps a running timer's total current without disturbing anything being clicked. */
  setInterval(() => {
    if (app.data && app.ui.tab === 'time' && app.runningTask() && !app.modalOpen() && !$('#panel').contains(document.activeElement) && !(document.activeElement && document.activeElement.matches('select'))) app.views.time();
  }, 30000);
})(window);
