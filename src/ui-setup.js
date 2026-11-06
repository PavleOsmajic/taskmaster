/* First run, reconnecting a data folder, damaged-file protection and changing storage. */
(function (root) {
  'use strict';
  const C = root.TMCore, S = root.TMStorage, app = root.TMApp;
  const $ = app.$, esc = C.esc;
  let chosenName = '';

  function screen(html) {
    document.body.classList.add('setup-mode');
    $('#root').innerHTML = `<div class="setup"><div class="setup-card"><div class="brand big">${app.CROSS}<span>Task<b>master</b></span><small>1.0</small></div>${html}</div></div>`;
    const first = $('.setup input');
    if (first) first.focus();
  }

  function askName() {
    screen(`<div class="eyebrow">Welcome</div><h1>What's your <em>name?</em></h1>
      <p>Your tasks and notes stay on this computer, in your own list.</p>
      <form data-form="setupName"><label class="field"><span>Your name</span><input id="setupName" maxlength="60" autocomplete="name" required></label>
      <div class="modal-acts"><button class="btn primary">Continue</button></div></form>`);
  }
  function askStorage(changing) {
    const folderOk = S.supportsFolder();
    screen(`<div class="eyebrow">${changing ? 'Change storage' : 'Step 2 of 2'}</div><h1>Where should Taskmaster <em>save?</em></h1>
      <div class="choices">
        <button class="choice" data-act="useFolder" ${folderOk ? '' : 'disabled'}><b>A folder on this computer${folderOk ? ' (recommended)' : ''}</b><span>${folderOk ? 'Saves a file you can see and back up, plus five automatic backups. Choose an empty folder, or one you already use.' : 'This browser can\'t do this. Open Taskmaster in Chrome or Edge to use it.'}</span></button>
        <button class="choice" data-act="useBrowser"><b>In this browser</b><span>Nothing to set up, but clearing your browser data deletes your tasks, so export a backup file regularly.</span></button>
      </div>
      ${changing ? '<div class="modal-acts"><button class="btn" data-act="reloadApp">Cancel</button></div>' : ''}
      <p class="setup-error" id="setupError" role="alert"></p>`);
  }
  app.actions.reloadApp = () => location.reload();

  app.forms.setupName = () => {
    chosenName = $('#setupName').value.trim();
    if (chosenName) askStorage(false);
  };

  function showDamaged(store, err) {
    app.setStore(store);
    screen(`<div class="eyebrow">Your data is protected</div><h1>Your saved data <em>couldn't be read</em></h1>
      <p>${esc(err.message)} Nothing has been overwritten. You can restore an automatic backup, or use a different ${store.mode === 'folder' ? 'folder' : 'storage option'}.</p>
      <div class="modal-acts wrap">
        <button class="btn" data-act="changeStorage">Choose different storage</button>
        <button class="btn primary" data-act="restoreDamaged">See backups</button>
      </div><p class="setup-error" id="setupError" role="alert"></p>`);
  }
  /* Shows what each backup holds, so an older or empty one is never restored by surprise. */
  let restoreChoices = [];
  app.actions.restoreDamaged = async () => {
    const out = $('#setupError');
    try {
      const list = await app.store.listBackups();
      restoreChoices = list.map(text => { try { return { text, d: C.parseDataFile(text) }; } catch (e) { return null; } }).filter(Boolean);
      if (!restoreChoices.length) { out.textContent = 'There are no usable backups. If you have an exported backup file, choose different storage, then restore it from the person menu.'; return; }
      screen(`<div class="eyebrow">Your data is protected</div><h1>Choose a version to <em>restore</em></h1>
        <p>The damaged file will be kept as a separate copy.</p>
        <div class="rows">${restoreChoices.map((c, i) => `<div class="row"><span><b>${c.d.savedAt ? esc(new Date(c.d.savedAt).toLocaleString()) : 'Earlier version'}</b><br><small>${c.d.tasks.length} tasks, ${c.d.notes.length} notes</small></span><button class="btn small primary" data-act="restoreChoice" data-i="${i}">Restore</button></div>`).join('')}</div>
        <div class="modal-acts"><button class="btn" data-act="reloadApp">Back</button></div><p class="setup-error" id="setupError" role="alert"></p>`);
    } catch (e) { out.textContent = `That didn't work: ${e.message}`; }
  };
  app.actions.restoreChoice = async el => {
    const out = $('#setupError');
    try {
      await app.store.keepDamagedCopy();
      await app.store.replace(restoreChoices[Number(el.dataset.i)].text);
      location.reload();
    } catch (e) { out.textContent = `That didn't work: ${e.message}`; }
  };

  /* Opens the store. Returns false after showing an error, so damaged data is never replaced by accident. */
  async function openStore(store) {
    const text = await store.load();
    if (text == null) return { fresh: true };
    try {
      app.data = C.parseDataFile(text);
      app.setStore(store);
      return { fresh: false };
    } catch (e) {
      showDamaged(store, e);
      return null;
    }
  }

  async function beginNew(store) {
    app.data = C.emptyData(chosenName || 'Me');
    app.setStore(store);
    await store.save(C.serialize(app.data));
    let old = null;
    try { old = await store.readOldData(); } catch (e) { old = null; }
    offerImport(old);
  }
  function offerImport(old) {
    screen(`<div class="eyebrow">Almost there</div><h1>Bring your tasks from <em>Taskmaster 0.4?</em></h1>
      <p>${old ? 'Your earlier Taskmaster data was found here.' : 'Choose your <b>clients.json</b> file or a 0.4 backup file.'} Importing only reads it, and never changes it.</p>
      <div class="modal-acts wrap">
        <button class="btn" data-act="startFresh">Start with an empty board</button>
        ${old ? '<button class="btn" data-act="pickSetupImport">Choose another file</button><button class="btn primary" data-act="importFound">Review import</button>' : '<button class="btn primary" data-act="pickSetupImport">Choose file</button>'}
      </div>`);
    app.actions.importFound = () => app.previewImport(old, ok => { if (ok) begin(); });
  }
  function begin() {
    app.start();
  }
  app.actions.startFresh = () => begin();
  app.actions.pickSetupImport = () => app.pickFile(text => app.previewImport(text, ok => { if (ok) begin(); }));
  app.actions.changeStorage = () => { app.closePopover && $('#popover') && app.closePopover(); askStorage(!!app.data); };

  /* Moving to new storage takes your current tasks and notes along, unless that place already has data. */
  async function adopt(store, mode) {
    const carrying = app.data;
    const opened = await openStore(store);
    if (!opened) return;
    if (opened.fresh) {
      if (carrying) { app.data = carrying; app.setStore(store); await store.save(C.serialize(carrying)); location.reload(); return; }
      if (!chosenName) { askName(); return; }
      await beginNew(store);
      return;
    }
    if (carrying) { location.reload(); return; }
    begin();
  }
  app.actions.useFolder = async () => {
    const out = $('#setupError');
    let handle;
    try { handle = await root.showDirectoryPicker({ mode: 'readwrite', id: 'taskmaster-data' }); }
    catch (e) { if (e.name !== 'AbortError') out.textContent = `That folder can't be used: ${e.message}`; return; }
    try {
      await S.rememberFolder(handle);
      S.setMode('folder');
      await adopt(S.createFolderStore(handle), 'folder');
    } catch (e) { out.textContent = `That folder can't be used: ${e.message}`; }
  };
  app.actions.useBrowser = async () => {
    const out = $('#setupError');
    try {
      S.setMode('browser');
      await adopt(S.createBrowserStore(), 'browser');
    } catch (e) { out.textContent = `Browser storage isn't available: ${e.message}`; }
  };

  function showReconnect(handle) {
    screen(`<div class="eyebrow">Welcome back</div><h1>Reconnect your <em>data folder</em></h1>
      <p>For safety, your browser asks before Taskmaster can reopen <b>${esc(handle.name)}</b>.</p>
      <div class="modal-acts wrap"><button class="btn" data-act="changeStorage">Use different storage</button><button class="btn primary" data-act="reconnect">Reconnect</button></div>
      <p class="setup-error" id="setupError" role="alert"></p>`);
    app.actions.reconnect = async () => {
      const out = $('#setupError');
      try {
        if (await handle.requestPermission({ mode: 'readwrite' }) !== 'granted') { out.textContent = 'Permission wasn\'t given, so your data stays closed.'; return; }
        await adopt(S.createFolderStore(handle), 'folder');
      } catch (e) { out.textContent = `Your data folder couldn't be opened: ${e.message}. It may have been moved or renamed.`; }
    };
  }

  async function init() {
    const mode = S.getMode();
    try {
      if (mode === 'browser') { await adopt(S.createBrowserStore(), 'browser'); return; }
      if (mode === 'folder') {
        const handle = await S.recallFolder();
        if (handle) {
          const perm = await handle.queryPermission({ mode: 'readwrite' });
          if (perm === 'granted') { await adopt(S.createFolderStore(handle), 'folder'); return; }
          showReconnect(handle);
          return;
        }
      }
    } catch (e) {
      screen(`<div class="eyebrow">Something went wrong</div><h1>Your data <em>couldn't be opened</em></h1><p>${esc(e.message)}. Nothing has been changed.</p><div class="modal-acts"><button class="btn" data-act="changeStorage">Choose storage</button><button class="btn primary" data-act="reloadApp">Try again</button></div>`);
      return;
    }
    askName();
  }
  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();
})(window);
