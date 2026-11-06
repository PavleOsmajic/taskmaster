/* The Notes tab: simple dated notes with search. */
(function (root) {
  'use strict';
  const C = root.TMCore, app = root.TMApp;
  const $ = app.$, esc = C.esc;

  const note = id => app.data.notes.find(n => n.id === id);
  const firstLine = n => (n.title || n.body.split('\n')[0] || 'Untitled note').slice(0, 80);
  function filtered() {
    const q = app.ui.noteSearch.trim().toLowerCase();
    return app.data.notes
      .filter(n => !q || [n.title, n.body, n.clientTag].join(' ').toLowerCase().includes(q))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)));
  }
  function listHTML() {
    const list = filtered();
    if (!list.length) return `<p class="muted pad">${app.ui.noteSearch ? 'No notes match that search.' : 'No notes yet.'}</p>`;
    return list.map(n => `<button class="nrow ${app.ui.noteId === n.id ? 'on' : ''}" data-act="pickNote" data-id="${esc(n.id)}"><b>${esc(firstLine(n))}</b><small>${esc(C.fmtDay(n.date))}${n.clientTag ? ` · ${esc(n.clientTag)}` : ''}</small></button>`).join('');
  }
  function editorHTML(n) {
    if (!n) return '<div class="empty inline"><h2>Meeting notes and anything else</h2><p>Select a note, or create a new one.</p></div>';
    const tags = app.clientNames();
    return `<input class="ntitle" data-n="title" value="${esc(n.title)}" placeholder="Title" aria-label="Note title">
      <div class="nmeta"><label class="inline"><span class="lab">Date</span><input type="date" data-n="date" value="${esc(n.date)}"></label>
      <label class="inline"><span class="lab">Client</span><input data-n="clientTag" list="noteTags" value="${esc(n.clientTag)}" placeholder="Optional"><datalist id="noteTags">${tags.map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
      <span class="sp"></span><button class="btn small danger" data-act="deleteNote">Delete</button></div>
      <textarea class="nbody" data-n="body" placeholder="Write here. Everything saves automatically." aria-label="Note text">${esc(n.body)}</textarea>`;
  }
  app.views.notes = function () {
    const active = document.activeElement;
    const inNotes = active && $('#notesRoot') && $('#notesRoot').contains(active) && active.matches('input,textarea');
    if (inNotes) { const l = $('#noteList'); if (l) l.innerHTML = listHTML(); return; }
    $('#view').innerHTML = `<div class="notes" id="notesRoot"><aside class="nside"><div class="nside-head"><button class="btn primary" data-act="newNote">+ New note</button><input id="noteSearch" type="search" class="search" placeholder="Search notes" aria-label="Search notes" value="${esc(app.ui.noteSearch)}"></div><div class="nlist" id="noteList">${listHTML()}</div></aside><section class="neditor" id="noteEditor">${editorHTML(note(app.ui.noteId))}</section></div>`;
  };
  const redrawEditor = () => { $('#noteEditor').innerHTML = editorHTML(note(app.ui.noteId)); $('#noteList').innerHTML = listHTML(); };
  app.actions.pickNote = el => { app.ui.noteId = el.dataset.id; redrawEditor(); };
  app.actions.newNote = () => {
    const n = C.newNote({ ownerId: app.data.owner.id, date: app.today() });
    app.data.notes.push(n);
    app.ui.noteId = n.id;
    app.ui.noteSearch = '';
    app.scheduleSave();
    app.views.notes();
    const t = $('.ntitle');
    if (t) t.focus();
  };
  app.actions.deleteNote = () => {
    const n = note(app.ui.noteId);
    if (!n) return;
    app.ui.noteId = null;
    app.change('Delete note', () => { app.data.notes = app.data.notes.filter(x => x.id !== n.id); }, { toast: `Note deleted: ${firstLine(n)}` });
    app.views.notes();
  };
  /* A client typed on a note joins the saved list once you leave the box. */
  document.addEventListener('change', ev => {
    if (!ev.target.dataset || ev.target.dataset.n !== 'clientTag') return;
    const n = note(app.ui.noteId);
    if (!n) return;
    n.clientTag = app.rememberClient(ev.target.value);
    ev.target.value = n.clientTag;
    $('#noteList').innerHTML = listHTML();
    app.scheduleSave();
  });
  document.addEventListener('input', ev => {
    if (ev.target.id === 'noteSearch') { app.ui.noteSearch = ev.target.value; $('#noteList').innerHTML = listHTML(); return; }
    const f = ev.target.dataset && ev.target.dataset.n;
    if (!f || !$('#noteEditor') || !$('#noteEditor').contains(ev.target)) return;
    const n = note(app.ui.noteId);
    if (!n) return;
    if (f === 'date' && !ev.target.value) return; // a note always keeps a date
    n[f] = ev.target.value;
    n.updatedAt = new Date().toISOString();
    $('#noteList').innerHTML = listHTML();
    app.scheduleSave();
  });
})(window);
