/* The Clients tab: the saved list of clients, with what each one has going on. */
(function (root) {
  'use strict';
  const C = root.TMCore, app = root.TMApp;
  const $ = app.$, esc = C.esc;
  let filter = '';

  const clients = () => app.data.clients;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  function statsHTML(c) {
    const s = C.clientStats(c.name, app.tasks(), app.data.notes);
    const time = s.seconds ? `${C.formatDuration(s.seconds)}${C.hoursLabel(s.seconds) ? ` (${C.hoursLabel(s.seconds)})` : ''}` : 'No time';
    return `<span class="cstat"><b>${s.open}</b> open</span><span class="cstat"><b>${s.done}</b> done</span><span class="cstat"><b>${s.notes}</b> note${s.notes === 1 ? '' : 's'}</span><span class="cstat ctime">${esc(time)}</span>`;
  }
  function rowsHTML() {
    const q = filter.trim().toLowerCase();
    const list = [...clients()].sort((a, b) => a.name.localeCompare(b.name)).filter(c => !q || c.name.toLowerCase().includes(q));
    if (!list.length) return `<div class="empty inline"><h2>${clients().length ? 'No clients match that search' : 'No clients yet'}</h2><p>${clients().length ? 'Try another name.' : 'Add one above, or type a client on any task and it will be saved here.'}</p></div>`;
    return list.map(c => `<div class="crow">
      <input class="cname" data-client-name="${esc(c.id)}" value="${esc(c.name)}" aria-label="Client name" title="Type to rename">
      ${statsHTML(c)}
      <span class="sp"></span>
      <button class="btn small" data-act="clientTasks" data-id="${esc(c.id)}">Show tasks</button>
      <button class="btn small danger" data-act="removeClient" data-id="${esc(c.id)}">Remove</button>
    </div>`).join('');
  }
  app.views.clients = function () {
    const n = clients().length;
    $('#view').innerHTML = `<div class="page">
      <div class="page-band">
        <div class="eyebrow">Clients</div>
        <h1>${plural(n, 'client')}</h1>
        <div class="page-tools">
          <form class="cadd" data-form="addClient"><input id="newClient" autocomplete="off" placeholder="New client name" aria-label="New client name"><button class="btn primary small">Add client</button></form>
          <input id="clientSearch" class="search" type="search" placeholder="Search clients" aria-label="Search clients" value="${esc(filter)}">
        </div>
      </div>
      <div class="page-body narrow"><div id="clientRows">${rowsHTML()}</div></div>
    </div>`;
  };
  const again = id => { const el = $(id); if (el) el.focus(); };

  app.forms.addClient = () => {
    const input = $('#newClient'), name = input.value.trim();
    if (!name) { input.focus(); return; }
    const existing = C.findClient(clients(), name);
    if (existing) { app.toast(`${existing.name} is already on your list`, { ms: 3000 }); input.select(); return; }
    filter = '';
    app.change('Add client', () => C.addClient(clients(), name, app.data.owner.id), { toast: `Client added: ${name}` });
    app.fx.sound('create');
    again('#newClient');
  };

  /* Renaming also updates every task, note, template and area using the old name. */
  document.addEventListener('change', ev => {
    const id = ev.target.dataset && ev.target.dataset.clientName;
    if (!id) return;
    const c = clients().find(x => x.id === id), name = ev.target.value.trim();
    if (!c) return;
    if (!name) { ev.target.value = c.name; return; }
    if (name === c.name) return;
    const other = C.findClient(clients(), name);
    if (other && other !== c) {
      app.openModal(`<h2>Combine these <em>clients?</em></h2><p><b>${esc(other.name)}</b> is already on your list. Everything under <b>${esc(c.name)}</b> will move to it.</p><div class="modal-acts"><button class="btn" data-act="cancelMerge">Cancel</button><button class="btn primary" data-act="doRename" data-id="${esc(id)}" data-name="${esc(name)}">Combine</button></div>`);
      return;
    }
    rename(id, name);
  });
  document.addEventListener('keydown', ev => {
    if (ev.target.dataset && ev.target.dataset.clientName && ev.key === 'Enter') { ev.preventDefault(); ev.target.blur(); }
  });
  function rename(id, name) {
    const old = clients().find(x => x.id === id).name;
    let merged = false;
    app.change('Rename client', () => { merged = C.renameClient(app.data, id, name).merged; }, { toast: merged ? '' : `${old} renamed to ${name}` });
    if (merged) app.toast(`${old} combined into ${C.findClient(clients(), name).name}`, { undo: true });
  }
  app.actions.doRename = el => { app.closeModal(); rename(el.dataset.id, el.dataset.name); };
  app.actions.cancelMerge = () => { app.closeModal(); app.views.clients(); };

  app.actions.clientTasks = el => {
    const c = clients().find(x => x.id === el.dataset.id);
    if (!c) return;
    app.ui.search = c.name;
    app.ui.tab = 'board';
    $('#view').innerHTML = '';
    app.render();
  };

  app.actions.removeClient = el => {
    const c = clients().find(x => x.id === el.dataset.id);
    if (!c) return;
    const s = C.clientStats(c.name, app.tasks(), app.data.notes), used = s.open + s.done + s.notes;
    if (!used) { removeNow(c.id, false); return; }
    const uses = [s.open + s.done ? plural(s.open + s.done, 'task') : '', s.notes ? plural(s.notes, 'note') : ''].filter(Boolean).join(' and ');
    app.openModal(`<h2>Remove <em>${esc(c.name)}?</em></h2><p>This client is on ${esc(uses)}. Removing it from your list keeps their history, but stops suggesting the name. You can also clear the name from them.</p>
      <div class="modal-acts wrap"><button class="btn" data-act="closeModal">Cancel</button><button class="btn danger" data-act="removeClientYes" data-id="${esc(c.id)}" data-clear="1">Remove and clear from ${esc(uses)}</button><button class="btn primary" data-act="removeClientYes" data-id="${esc(c.id)}">Remove from list</button></div>`);
  };
  function removeNow(id, clear) {
    const c = clients().find(x => x.id === id);
    app.change('Remove client', () => C.removeClient(app.data, id, { clear }), { toast: `Client removed: ${c.name}` });
  }
  app.actions.removeClientYes = el => { app.closeModal(); removeNow(el.dataset.id, !!el.dataset.clear); };

  document.addEventListener('input', ev => {
    if (ev.target.id === 'clientSearch') { filter = ev.target.value; $('#clientRows').innerHTML = rowsHTML(); }
  });

  /* Clicking a client box opens its list straight away, where the browser allows it. */
  document.addEventListener('click', ev => {
    const el = ev.target;
    if (!el.matches || !el.matches('input[list]') || el.value) return;
    try { el.showPicker(); } catch (e) { /* typing still brings up the list */ }
  });
})(window);
