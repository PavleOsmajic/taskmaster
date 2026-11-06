/* The only code that reads or writes saved data. A server version can replace these stores later. */
(function (root) {
  'use strict';
  const C = root.TMCore;
  const DATA_FILE = 'taskmaster.json';
  const OLD_FILE = 'clients.json';
  const BACKUP_DIR = 'backups';
  const BACKUP_LIMIT = 5;
  const BACKUP_GAP_MS = 5 * 60 * 1000; // dragging notes saves often, so backups stay spaced apart
  const LS_DATA = 'taskmaster.v1.data';
  const LS_BACKUPS = 'taskmaster.v1.backups';
  const LS_MODE = 'taskmaster.mode';
  const OLD_LS = 'clientTrackerData';

  class ConflictError extends Error {
    constructor() { super('The saved data changed outside this window.'); this.name = 'ConflictError'; }
  }

  async function readOptional(dir, name) {
    try { return await (await (await dir.getFileHandle(name)).getFile()).text(); }
    catch (e) { if (e.name === 'NotFoundError') return null; throw e; }
  }
  async function writeFile(dir, name, text) {
    const h = await dir.getFileHandle(name, { create: true });
    const w = await h.createWritable();
    await w.write(text);
    await w.close();
  }

  function createFolderStore(dir) {
    let lastSeen = null, lastBackup = 0;
    const stamp = async () => {
      try { return (await (await dir.getFileHandle(DATA_FILE)).getFile()).lastModified; }
      catch (e) { if (e.name === 'NotFoundError') return null; throw e; }
    };
    const rotate = async previous => {
      const backups = await dir.getDirectoryHandle(BACKUP_DIR, { create: true });
      for (let i = BACKUP_LIMIT - 1; i >= 1; i--) {
        const old = await readOptional(backups, `taskmaster-backup-${i}.json`);
        if (old) await writeFile(backups, `taskmaster-backup-${i + 1}.json`, old);
      }
      await writeFile(backups, 'taskmaster-backup-1.json', previous);
    };
    return {
      mode: 'folder',
      label: dir.name,
      async load() {
        const text = await readOptional(dir, DATA_FILE);
        lastSeen = await stamp();
        return text;
      },
      async save(text, opts) {
        const current = await stamp();
        if (!(opts && opts.force) && current !== lastSeen) throw new ConflictError();
        if (current !== null && Date.now() - lastBackup >= BACKUP_GAP_MS) {
          const previous = await readOptional(dir, DATA_FILE);
          if (previous) {
            let good = true;
            try { C.parseDataFile(previous); } catch (e) { good = false; }
            if (good) await rotate(previous);
            lastBackup = Date.now();
          }
        }
        await writeFile(dir, DATA_FILE, text);
        lastSeen = await stamp();
      },
      async listBackups() {
        let backups;
        try { backups = await dir.getDirectoryHandle(BACKUP_DIR); }
        catch (e) { if (e.name === 'NotFoundError') return []; throw e; }
        const out = [];
        for (let i = 1; i <= BACKUP_LIMIT; i++) {
          const text = await readOptional(backups, `taskmaster-backup-${i}.json`);
          if (text) out.push(text);
        }
        return out;
      },
      async keepDamagedCopy() {
        const text = await readOptional(dir, DATA_FILE);
        if (text != null) await writeFile(dir, `taskmaster-damaged-${Date.now()}.json`, text);
      },
      async readOldData() { return readOptional(dir, OLD_FILE); },
      /* Called when someone has confirmed replacing a damaged file. */
      async replace(text) { await writeFile(dir, DATA_FILE, text); lastSeen = await stamp(); },
    };
  }

  function createBrowserStore() {
    let lastSeen = null;
    return {
      mode: 'browser',
      label: 'this browser',
      async load() {
        lastSeen = localStorage.getItem(LS_DATA);
        return lastSeen;
      },
      async save(text, opts) {
        const current = localStorage.getItem(LS_DATA);
        if (!(opts && opts.force) && current !== lastSeen) throw new ConflictError();
        if (current) {
          try {
            let records = [];
            try { records = JSON.parse(localStorage.getItem(LS_BACKUPS) || '[]'); } catch (e) { records = []; }
            const newest = records[0] && records[0].at;
            if (!newest || Date.now() - newest >= BACKUP_GAP_MS) {
              C.parseDataFile(current);
              records = [{ at: Date.now(), text: current }, ...records].slice(0, BACKUP_LIMIT);
              localStorage.setItem(LS_BACKUPS, JSON.stringify(records));
            }
          } catch (e) { /* A failed backup must not stop the real save below. */ }
        }
        try { localStorage.setItem(LS_DATA, text); }
        catch (e) {
          localStorage.removeItem(LS_BACKUPS); // browser storage is full, so the current data matters most
          localStorage.setItem(LS_DATA, text);
        }
        lastSeen = text;
      },
      async listBackups() {
        try { return JSON.parse(localStorage.getItem(LS_BACKUPS) || '[]').map(r => r.text); } catch (e) { return []; }
      },
      async keepDamagedCopy() {
        const text = localStorage.getItem(LS_DATA);
        if (text != null) localStorage.setItem(`taskmaster.damaged.${Date.now()}`, text);
      },
      async readOldData() { return localStorage.getItem(OLD_LS); },
      async replace(text) { localStorage.setItem(LS_DATA, text); lastSeen = text; },
    };
  }

  /* Browsers keep folder access in IndexedDB between visits. */
  function handleDb() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open('taskmaster-handles', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('handles');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  async function rememberFolder(handle) {
    const db = await handleDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').put(handle, 'data');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
  async function recallFolder() {
    try {
      const db = await handleDb();
      return await new Promise((resolve, reject) => {
        const r = db.transaction('handles').objectStore('handles').get('data');
        r.onsuccess = () => resolve(r.result || null);
        r.onerror = () => reject(r.error);
      });
    } catch (e) { return null; }
  }
  const getMode = () => { try { return localStorage.getItem(LS_MODE); } catch (e) { return null; } };
  const setMode = m => { try { localStorage.setItem(LS_MODE, m); } catch (e) { /* the folder choice still works this visit */ } };

  /* A copy of the theme choice on this computer, so screens shown before your data opens match it. */
  const LS_THEME = 'taskmaster.theme';
  const getThemeHint = () => { try { return localStorage.getItem(LS_THEME); } catch (e) { return null; } };
  const setThemeHint = t => { try { localStorage.setItem(LS_THEME, t); } catch (e) { /* the saved preference still applies once data opens */ } };

  root.TMStorage = {
    getThemeHint, setThemeHint,
    ConflictError, createFolderStore, createBrowserStore, rememberFolder, recallFolder, getMode, setMode,
    supportsFolder: () => typeof root.showDirectoryPicker === 'function',
  };
})(window);
