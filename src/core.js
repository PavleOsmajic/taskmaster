/* Taskmaster core logic: no screen code here, so Node can test all of it. */
(function (root) {
  'use strict';

  const COLORS = { yellow: '#f6df86', pink: '#f2b5c5', peach: '#f5c49d', green: '#c5dda0', blue: '#aed4ea', lavender: '#d1c1ee', mint: '#a9e6cf', teal: '#8dd0d6', coral: '#f4a492', sand: '#e4d3b0', white: '#ffffff' };
  const PRIORITIES = ['high', 'medium', 'low'];
  const PRIORITY_LABEL = { high: 'High', medium: 'Normal', low: 'Low' };
  const STATUSES = ['progress', 'waiting', 'done'];
  const STATUS_LABEL = { progress: 'In progress', waiting: 'Waiting', done: 'Done' };
  const SERVICES = { paid: 'Meta Ads', google: 'Google Ads', organic: 'Organic', other: 'Other', personal: 'Personal' };
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const NOTE_W = 280, NOTE_MIN_W = 190, NOTE_MAX_W = 560, NOTE_MAX_H = 1200;
  const DEFAULT_PREFS = { calendar: 'off', zoom: 1, panX: 0, panY: 0, timeFormat: 'decimal', rounding: 0, sound: true, effects: true, defaultView: 'sticky', listSort: 'order', templatePrompt: true, theme: 'light' };
  const THEMES = { light: 'Light', dark: 'Dark', system: 'Match my computer' };
  const VIEWS = { sticky: 'Sticky notes', list: 'List', columns: 'Columns' };

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- dates: always local days written as YYYY-MM-DD ---------- */
  const pad = n => String(n).padStart(2, '0');
  const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const isISODate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  function parseDay(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function todayISO(now) { return isoOf(now || new Date()); }
  function localDate(v) {
    if (!v) return null;
    if (isISODate(v)) return v;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : isoOf(d);
  }
  function addDays(iso, n) {
    const d = parseDay(iso);
    d.setDate(d.getDate() + n);
    return isoOf(d);
  }
  function daysBetween(a, b) { return Math.round((parseDay(b) - parseDay(a)) / 86400000); }
  function weekStart(iso) {
    const dow = parseDay(iso).getDay();
    return addDays(iso, dow === 0 ? -6 : 1 - dow);
  }
  function weekDays(startISO) { return Array.from({ length: 7 }, (_, i) => addDays(startISO, i)); }
  function monthGrid(year, month) {
    const first = `${year}-${pad(month)}-01`;
    const last = isoOf(new Date(year, month, 0));
    const weeks = [];
    for (let s = weekStart(first); s <= last; s = addDays(s, 7)) weeks.push(weekDays(s));
    return weeks;
  }
  function fmtDay(iso) {
    const d = parseDay(iso);
    return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
  }
  const isClockTime = s => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  const clockOf = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  /* True once today's due time has gone by. Without a clock, only the date counts. */
  const pastDueTime = (t, today, now) => !!now && t.due === today && !!t.dueTime && clockOf(now) > t.dueTime;
  function dueLabel(t, today, now) {
    if (!t.due) return { text: 'No date', kind: 'none' };
    const at = t.dueTime ? `, ${t.dueTime}` : '';
    if (t.status === 'done') return { text: fmtDay(t.due) + at, kind: '' };
    if (pastDueTime(t, today, now)) return { text: `Late, was due ${t.dueTime}`, kind: 'late' };
    if (t.due === today) return { text: `Due today${at}`, kind: 'today' };
    if (t.due < today) {
      const n = daysBetween(t.due, today);
      return { text: `${n} day${n === 1 ? '' : 's'} late`, kind: 'late' };
    }
    return { text: fmtDay(t.due) + at, kind: '' };
  }

  /* ---------- tasks and notes ---------- */
  function newTask(o) {
    const now = new Date().toISOString();
    return {
      id: uid(), ownerId: null, title: 'Untitled task', desc: '', priority: 'medium', status: 'progress', color: 'yellow',
      start: null, due: null, dueTime: null, clientTag: '', service: '', withName: '', waitingOn: '', subtasks: [], position: null, size: null, z: 0, rank: null, listRank: null,
      star: false, tucked: false, recurrence: 'none', recurrenceAnchorDay: null, recurrenceSpawned: false,
      timeSessions: [], timerStartedAt: null, loggedDays: {}, templatePrompted: false,
      createdAt: now, updatedAt: now, completedAt: null, legacy: null,
      ...(o || {}),
    };
  }
  function newNote(o) {
    const now = new Date().toISOString();
    return { id: uid(), ownerId: null, title: '', date: todayISO(), body: '', clientTag: '', createdAt: now, updatedAt: now, ...(o || {}) };
  }
  const clampWidth = w => Math.min(NOTE_MAX_W, Math.max(NOTE_MIN_W, Math.round(w)));
  function noteWidth(t) { return t.size && Number.isFinite(t.size.w) ? clampWidth(t.size.w) : NOTE_W; }
  /* Text grows with the note, but never gets too small to read. */
  function noteTextScale(w) { return Math.round(Math.max(0.85, Math.min(2, w / NOTE_W)) * 100) / 100; }
  /* Bigger notes have room to show more of their subtasks. */
  function subtaskLimit(w) { return w >= 480 ? 10 : w >= 360 ? 6 : 3; }
  function cleanSize(size) {
    if (!size || !Number.isFinite(size.w)) return null;
    const h = Number.isFinite(size.h) && size.h > 0 ? Math.min(NOTE_MAX_H, Math.round(size.h)) : null;
    return { w: clampWidth(size.w), h };
  }
  /* Normal is the default, so only high and low get a label. */
  function priorityBadge(t) { return t.priority === 'medium' ? '' : `<span class="pri">${PRIORITY_LABEL[t.priority]}</span>`; }
  function addedLabel(t, today) {
    const v = t.createdAt;
    const day = localDate(v);
    if (!day) return '';
    const d = parseDay(day);
    let when;
    if (day === today) when = 'today';
    else if (day === addDays(today, -1)) when = 'yesterday';
    else when = `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}${d.getFullYear() === parseDay(today).getFullYear() ? '' : ` ${d.getFullYear()}`}`;
    if (isISODate(v)) return `Added ${when}`;
    const at = new Date(v);
    return `Added ${when}, ${pad(at.getHours())}:${pad(at.getMinutes())}`;
  }
  const isDone = t => t.status === 'done';
  function inTray(t) { return isDone(t); }
  function listGroups(tasks, today) {
    const weekOut = addDays(today, 7);
    const groups = [
      { key: 'overdue', label: 'Overdue', test: t => t.due && t.due < today },
      { key: 'today', label: 'Today', test: t => t.due === today },
      { key: 'soon', label: 'Next 7 days', test: t => t.due && t.due > today && t.due <= weekOut },
      { key: 'later', label: 'Later', test: t => t.due && t.due > weekOut },
      { key: 'none', label: 'No date', test: t => !t.due },
    ];
    const open = tasks.filter(t => !isDone(t));
    return groups.map(({ key, label, test }) => ({ key, label, items: tidyOrder(open.filter(test)) })).filter(g => g.items.length);
  }
  function columnOrder(tasks) {
    const chosen = tasks.filter(t => Number.isFinite(t.rank)).sort((a, b) => a.rank - b.rank);
    return [...chosen, ...tidyOrder(tasks.filter(t => !Number.isFinite(t.rank)))];
  }
  function columnGroups(tasks, today) {
    const done = tasks.filter(isDone);
    const doneToday = done.filter(t => localDate(t.completedAt) === today)
      .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
    return [
      { key: 'progress', label: 'In progress', items: columnOrder(tasks.filter(t => t.status === 'progress')) },
      { key: 'waiting', label: 'Waiting', items: columnOrder(tasks.filter(t => t.status === 'waiting')) },
      { key: 'done', label: 'Done today', items: doneToday, earlier: done.length - doneToday.length },
    ];
  }
  function moveInOrder(ids, id, index) {
    const rest = ids.filter(x => x !== id);
    rest.splice(Math.min(index, rest.length), 0, id);
    return rest;
  }
  function inFocus(t, today) { return !isDone(t) && (!!t.star || (!!t.due && t.due <= today)); }
  function isOverdue(t, today, now) { return !isDone(t) && !!t.due && (t.due < today || pastDueTime(t, today, now)); }
  function previewSubtasks(subs, limit = 3) {
    const list = subs || [];
    const open = list.filter(s => !s.done).slice(0, limit);
    const picked = new Set(open);
    const done = list.filter(s => s.done);
    for (let i = done.length - 1; i >= 0 && picked.size < limit; i--) picked.add(done[i]);
    const shown = list.filter(s => picked.has(s));
    return { shown, more: list.length - shown.length };
  }
  function clientTags(tasks, notes) {
    const seen = new Map();
    for (const x of [...(tasks || []), ...(notes || [])]) {
      const tag = (x.clientTag || '').trim();
      if (tag && !seen.has(tag.toLowerCase())) seen.set(tag.toLowerCase(), tag);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }

  /* ---------- the saved client list ---------- */
  const clientKey = name => String(name || '').trim().toLowerCase();
  function findClient(list, name) {
    const key = clientKey(name);
    return key ? list.find(c => clientKey(c.name) === key) || null : null;
  }
  /* Saves a client if it's new, and returns the spelling to use. */
  function addClient(list, name, ownerId) {
    const clean = String(name || '').trim();
    if (!clean) return '';
    const known = findClient(list, clean);
    if (known) return known.name;
    list.push({ id: uid(), ownerId: ownerId || null, name: clean });
    return clean;
  }
  function cleanClients(raw, seedFrom, ownerId) {
    const out = [];
    if (Array.isArray(raw)) {
      for (const c of raw) {
        if (!c || typeof c !== 'object' || !String(c.name || '').trim() || findClient(out, c.name)) continue;
        out.push({ id: c.id || uid(), ownerId: c.ownerId || ownerId || null, name: String(c.name).trim() });
      }
      return out;
    }
    // Files saved before the client list existed start with every client already in use.
    for (const tag of clientTags(seedFrom)) addClient(out, tag, ownerId);
    return out;
  }
  /* What a client has going on. */
  function clientStats(name, tasks, notes) {
    const key = clientKey(name), mine = tasks.filter(t => clientKey(t.clientTag) === key);
    return {
      open: mine.filter(t => !isDone(t)).length,
      done: mine.filter(isDone).length,
      notes: notes.filter(n => clientKey(n.clientTag) === key).length,
      seconds: mine.reduce((sum, t) => sum + taskSeconds(t), 0),
    };
  }
  /* Renames a client everywhere. Renaming to another client's name combines the two. */
  function renameClient(data, id, name) {
    const c = data.clients.find(x => x.id === id), clean = String(name || '').trim();
    if (!c || !clean) return { merged: false };
    const other = data.clients.find(x => x !== c && clientKey(x.name) === clientKey(clean));
    const final = other ? other.name : clean, oldKey = clientKey(c.name);
    for (const item of [...data.tasks, ...data.notes, ...data.templates]) if (clientKey(item.clientTag) === oldKey) item.clientTag = final;
    for (const a of data.areas || []) if (clientKey(a.name) === oldKey) a.name = final;
    if (other) data.clients = data.clients.filter(x => x !== c);
    else c.name = clean;
    return { merged: !!other };
  }
  /* Takes a client off the list. Its name stays on old work unless you ask to clear it. */
  function removeClient(data, id, opts) {
    const c = data.clients.find(x => x.id === id);
    if (!c) return;
    data.clients = data.clients.filter(x => x !== c);
    if (opts && opts.clear) {
      const key = clientKey(c.name);
      for (const item of [...data.tasks, ...data.notes, ...data.templates]) if (clientKey(item.clientTag) === key) item.clientTag = '';
    }
  }

  /* ---------- quick add ---------- */
  const WEEKDAY_FULL = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const WEEKDAY_SHORT = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const PRIORITY_WORDS = { '!high': 'high', '!h': 'high', '!med': 'medium', '!medium': 'medium', '!m': 'medium', '!low': 'low', '!l': 'low' };

  function nextWeekday(dow, today) {
    const cur = parseDay(today).getDay();
    return addDays(today, (dow - cur + 7) % 7);
  }
  function monthIndex(word) {
    const w = word.toLowerCase();
    if (w.length < 3) return -1;
    let i = MONTH_NAMES.findIndex(m => m.toLowerCase() === w);
    if (i < 0) i = MONTH_FULL.findIndex(m => m.toLowerCase() === w);
    return i;
  }
  function dayMonth(day, month, today) {
    if (!(day >= 1 && day <= 31)) return null;
    let year = parseDay(today).getFullYear();
    const build = y => {
      const d = new Date(y, month, day);
      return d.getMonth() === month ? isoOf(d) : null;
    };
    const iso = build(year);
    if (!iso) return null;
    return iso >= today ? iso : build(year + 1);
  }
  function findDate(words, today, allowLone) {
    for (let i = 0; i < words.length; i++) {
      const w = words[i].toLowerCase();
      const next = words[i + 1];
      if (/^\d{1,2}$/.test(w) && next && monthIndex(next) >= 0) {
        const iso = dayMonth(Number(w), monthIndex(next), today);
        if (iso) return { iso, at: i, len: 2 };
      }
      if (monthIndex(w) >= 0 && next && /^\d{1,2}$/.test(next)) {
        const iso = dayMonth(Number(next), monthIndex(w), today);
        if (iso) return { iso, at: i, len: 2 };
      }
      if (w === 'today') return { iso: today, at: i, len: 1 };
      if (w === 'tomorrow' || w === 'tmrw') return { iso: addDays(today, 1), at: i, len: 1 };
      const f = WEEKDAY_FULL.indexOf(w);
      if (f >= 0) return { iso: nextWeekday(f, today), at: i, len: 1 };
    }
    // Short names like "sun" are real words, so they only count as the last word.
    if (words.length > 1 || (allowLone && words.length)) {
      const last = words[words.length - 1].toLowerCase();
      const s = WEEKDAY_SHORT.indexOf(last);
      if (s >= 0) return { iso: nextWeekday(s, today), at: words.length - 1, len: 1 };
    }
    return null;
  }
  /* Finds a time such as 14:30, 3pm, 3:30pm or at 9am. */
  function findTime(words) {
    for (let i = 0; i < words.length; i++) {
      const w = words[i].toLowerCase();
      let m = w.match(/^(\d{1,2})[:.](\d{2})(am|pm)?$/) || w.match(/^(\d{1,2})()(am|pm)$/);
      let len = 1;
      if (!m && /^\d{1,2}([:.]\d{2})?$/.test(w) && /^(am|pm)$/.test((words[i + 1] || '').toLowerCase())) {
        const parts = w.split(/[:.]/);
        m = [w, parts[0], parts[1] || '', words[i + 1].toLowerCase()];
        len = 2;
      }
      if (!m || (!m[3] && !w.includes(':'))) continue; // 3.30 alone could be a version or a price
      let h = Number(m[1]);
      const min = Number(m[2] || 0);
      if (m[3] && (h < 1 || h > 12)) continue;
      if (m[3] === 'pm' && h < 12) h += 12;
      if (m[3] === 'am' && h === 12) h = 0;
      if (h > 23 || min > 59) continue;
      const before = i > 0 && words[i - 1].toLowerCase() === 'at';
      return { time: `${pad(h)}:${pad(min)}`, at: before ? i - 1 : i, len: before ? len + 1 : len };
    }
    return null;
  }
  function parseQuickAdd(text, ctx) {
    const { today = todayISO(), clientTags: tags = [], templates = [], ignore = [], now = null } = ctx || {};
    const skip = k => ignore.includes(k);
    let working = String(text || '').trim();
    const out = { title: '', due: null, dueTime: null, priority: null, clientTag: null, templateId: null, chips: [] };

    if (working.startsWith('/') && !skip('template')) {
      const lower = working.slice(1).toLowerCase();
      const hit = [...templates].sort((a, b) => b.name.length - a.name.length)
        .find(t => lower === t.name.toLowerCase() || lower.startsWith(t.name.toLowerCase() + ' '));
      if (hit) {
        out.templateId = hit.id;
        out.chips.push({ kind: 'template', label: hit.name });
        working = working.slice(1 + hit.name.length).trim();
      }
    }
    if (!skip('client')) {
      const at = working.search(/(^|\s)#\S/);
      if (at >= 0) {
        const start = working.indexOf('#', at);
        const rest = working.slice(start + 1);
        const lowerRest = rest.toLowerCase();
        const known = [...tags].sort((a, b) => b.length - a.length)
          .find(t => lowerRest === t.toLowerCase() || lowerRest.startsWith(t.toLowerCase() + ' '));
        if (known) {
          out.clientTag = known;
          working = (working.slice(0, start) + rest.slice(known.length)).replace(/\s+/g, ' ').trim();
        } else {
          const token = rest.split(/\s/)[0];
          out.clientTag = token.replace(/[-_]+/g, ' ');
          working = (working.slice(0, start) + rest.slice(token.length)).replace(/\s+/g, ' ').trim();
        }
        out.chips.push({ kind: 'client', label: out.clientTag });
      }
    }
    let words = working ? working.split(/\s+/) : [];
    if (!skip('priority')) {
      const i = words.findIndex(w => PRIORITY_WORDS[w.toLowerCase()]);
      if (i >= 0) {
        out.priority = PRIORITY_WORDS[words[i].toLowerCase()];
        out.chips.push({ kind: 'priority', label: PRIORITY_LABEL[out.priority] });
        words.splice(i, 1);
      }
    }
    if (!skip('time')) {
      const found = findTime(words);
      if (found) {
        out.dueTime = found.time;
        out.chips.push({ kind: 'time', label: found.time });
        words.splice(found.at, found.len);
      }
    }
    if (!skip('date')) {
      const d = findDate(words, today, !!out.templateId);
      if (d) {
        out.due = d.iso;
        out.chips.push({ kind: 'date', label: fmtDay(d.iso) });
        words.splice(d.at, d.len);
      }
    }
    // A time with no date means its next occurrence.
    if (out.dueTime && !out.due) {
      out.due = now && clockOf(now) > out.dueTime ? addDays(today, 1) : today;
      out.chips.push({ kind: 'date', label: fmtDay(out.due) });
    }
    out.title = words.join(' ').trim();
    return out;
  }

  /* What a new task will be. Fields you set win, then what you typed, then the template, then the defaults. */
  function quickValues(parsed, tpl, user) {
    const u = user || {}, t = tpl || {}, p = parsed || {};
    const choose = (mine, typed, fromTemplate, fallback) => {
      if (mine !== undefined) return mine;
      if (typed !== undefined && typed !== null) return typed;
      if (fromTemplate !== undefined && fromTemplate !== null && fromTemplate !== '') return fromTemplate;
      return fallback;
    };
    const removed = u.removedSubs || [];
    const fromTemplate = (t.subtasks || []).map(s => (typeof s === 'string' ? s : s.name)).filter(name => !removed.includes(name));
    const spent = String(u.spent || '').trim();
    const seconds = parseDuration(spent) || 0;
    return {
      title: p.title || t.title || '',
      due: choose(u.due, p.due, undefined, null),
      dueTime: choose(u.dueTime, p.dueTime, undefined, null),
      start: choose(u.start, undefined, undefined, null),
      priority: choose(u.priority, p.priority, t.priority, 'medium'),
      clientTag: choose(u.clientTag, p.clientTag, t.clientTag, ''),
      service: choose(u.service, undefined, t.service, ''),
      color: choose(u.color, undefined, t.color, 'yellow'),
      desc: choose(u.desc, undefined, t.desc, ''),
      status: choose(u.status, undefined, undefined, 'progress'),
      waitingOn: choose(u.waitingOn, undefined, undefined, ''),
      recurrence: choose(u.recurrence, undefined, undefined, 'none'),
      withName: choose(u.withName, undefined, undefined, ''),
      star: !!u.star,
      startTimer: !!u.startTimer,
      subtasks: [...fromTemplate, ...(u.addedSubs || [])],
      spent,
      seconds,
      spentBad: !!spent && !seconds,
      fromTemplate: !!tpl,
    };
  }
  function taskFromQuick(v, opts) {
    const now = opts.now || new Date();
    const waiting = v.status === 'waiting';
    return newTask({
      ownerId: opts.ownerId, title: v.title.trim(), desc: v.desc, priority: v.priority, status: v.status, color: v.color,
      due: v.due, dueTime: v.due ? v.dueTime : null, start: v.start, clientTag: v.clientTag.trim(), service: v.service, withName: v.withName.trim(), waitingOn: waiting ? v.waitingOn.trim() : '',
      star: v.star, recurrence: v.recurrence, recurrenceAnchorDay: v.due && v.recurrence !== 'none' ? Number(v.due.slice(8)) : null,
      subtasks: v.subtasks.map(name => ({ id: uid(), name, done: false })),
      timeSessions: v.seconds ? [{ id: uid(), startedAt: new Date(now.getTime() - v.seconds * 1000).toISOString(), endedAt: now.toISOString(), seconds: v.seconds }] : [],
      templatePrompted: v.fromTemplate,
    });
  }

  /* ---------- time ---------- */
  function parseDuration(str) {
    const s = String(str || '').trim().toLowerCase().replace(',', '.');
    if (!s) return null;
    let sec = null;
    let m;
    if ((m = s.match(/^(\d+):(\d{1,2})$/))) sec = Number(m[1]) * 3600 + Number(m[2]) * 60;
    else if ((m = s.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?(?:\s*(\d+)\s*m(?:in(?:ute)?s?)?)?$/))) sec = Number(m[1]) * 3600 + Number(m[2] || 0) * 60;
    else if ((m = s.match(/^(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?$/))) sec = Number(m[1]) * 60;
    else if ((m = s.match(/^(\d+(?:\.\d+)?)$/))) sec = Number(m[1]) * 60;
    return sec && sec > 0 ? Math.round(sec) : null;
  }
  function formatDuration(sec) {
    const mins = Math.floor((sec || 0) / 60);
    const h = Math.floor(mins / 60), m = mins % 60;
    if (!h) return `${m}m`;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  function formatClock(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  }
  function roundSeconds(sec, minutes) {
    if (!minutes || !sec) return sec;
    const step = minutes * 60;
    return Math.max(step, Math.round(sec / step) * step);
  }
  /* Hours as Basecamp takes them: 5400 seconds is 1.5, and 4800 seconds is 1.33. */
  function formatHours(sec) {
    return String(Math.round((sec || 0) / 36) / 100);
  }
  function hoursLabel(sec) {
    const hours = formatHours(sec);
    return hours === '0' ? '' : `${hours} h`;
  }
  function formatTimeValue(sec, fmt) {
    return fmt === 'decimal' ? formatHours(sec) : formatDuration(sec);
  }
  function runningSeconds(t, now) {
    if (!t.timerStartedAt) return 0;
    return Math.max(0, Math.floor((now.getTime() - Date.parse(t.timerStartedAt)) / 1000));
  }
  function taskSeconds(t, now) {
    return (t.timeSessions || []).reduce((sum, s) => sum + (s.seconds || 0), 0) + runningSeconds(t, now || new Date());
  }
  function pauseTimer(t, now) {
    if (!t.timerStartedAt) return;
    const seconds = runningSeconds(t, now);
    if (seconds >= 1) t.timeSessions.push({ id: uid(), startedAt: t.timerStartedAt, endedAt: now.toISOString(), seconds });
    t.timerStartedAt = null;
  }
  /* Like parseDuration, but zero is allowed, since you may want to clear tracked time. */
  function parseTimeEdit(str) {
    if (/^0+([.,:]0+)?\s*(h|hrs?|hours?|m|mins?|minutes?)?$/i.test(String(str || '').trim())) return 0;
    return parseDuration(str);
  }
  /* Makes tracked time add up to a total you choose, for the whole task or one day. Stops its timer first. */
  function setTrackedTime(t, seconds, opts) {
    const { date = null, now = new Date() } = opts || {};
    pauseTimer(t, now);
    const matching = t.timeSessions.filter(s => !date || localDate(s.startedAt) === date)
      .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
    const diff = seconds - matching.reduce((sum, s) => sum + (s.seconds || 0), 0);
    const endFrom = s => new Date(Date.parse(s.startedAt) + s.seconds * 1000).toISOString();
    if (diff > 0) {
      if (matching.length) {
        matching[0].seconds += diff;
        matching[0].endedAt = endFrom(matching[0]);
      } else {
        const pastDay = date && date !== todayISO(now);
        const start = pastDay ? new Date(parseDay(date).getTime() + 9 * 3600000) : new Date(now.getTime() - diff * 1000);
        const session = { id: uid(), startedAt: start.toISOString(), endedAt: '', seconds: diff };
        session.endedAt = endFrom(session);
        t.timeSessions.push(session);
      }
    } else if (diff < 0) {
      let left = -diff;
      for (const s of matching) {
        const cut = Math.min(s.seconds || 0, left);
        s.seconds -= cut;
        s.endedAt = endFrom(s);
        left -= cut;
      }
      t.timeSessions = t.timeSessions.filter(s => s.seconds > 0);
    }
  }
  const FORGOTTEN_AFTER = 4 * 3600;
  /* A timer left going since an earlier day, or for hours, was probably forgotten. */
  function timerLooksForgotten(t, now) {
    if (!t.timerStartedAt) return false;
    return localDate(t.timerStartedAt) < todayISO(now) || runningSeconds(t, now) >= FORGOTTEN_AFTER;
  }
  /* A sensible first guess at when work stopped: the last activity in the app, or an hour in. */
  function timerStopGuess(t, lastActive, now) {
    const start = Date.parse(t.timerStartedAt), last = Date.parse(lastActive), end = now.getTime();
    if (last > start + 60000 && last <= end) return new Date(last);
    return new Date(Math.min(start + 3600000, end));
  }
  /* Ends a running timer at a time you choose. Returns false, changing nothing, if that time is impossible. */
  function stopTimerAt(t, when, now) {
    if (!t.timerStartedAt) return false;
    const start = Date.parse(t.timerStartedAt), asked = when instanceof Date ? when.getTime() : NaN, latest = now.getTime();
    if (!Number.isFinite(asked) || asked <= start || asked >= latest + 60000) return false; // a chosen minute may run just past now
    const end = Math.min(asked, latest);
    t.timeSessions.push({ id: uid(), startedAt: t.timerStartedAt, endedAt: new Date(end).toISOString(), seconds: Math.floor((end - start) / 1000) });
    t.timerStartedAt = null;
    return true;
  }
  /* The text form a date and time box expects, in local time. */
  function localDateTimeValue(d) {
    return `${isoOf(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function timeRows(tasks, startISO, opts) {
    const { now = new Date(), rounding = 0 } = opts || {};
    const days = weekDays(startISO);
    const out = [];
    for (const date of days) {
      const rows = [];
      for (const t of tasks) {
        let seconds = 0;
        for (const s of t.timeSessions || []) if (localDate(s.startedAt) === date) seconds += s.seconds || 0;
        if (t.timerStartedAt && localDate(t.timerStartedAt) === date) seconds += runningSeconds(t, now);
        if (seconds <= 0) continue;
        const loggedSeconds = (t.loggedDays && t.loggedDays[date]) || 0;
        rows.push({ taskId: t.id, title: t.title, clientTag: t.clientTag || '', seconds, display: roundSeconds(seconds, rounding), logged: loggedSeconds >= seconds, loggedSeconds, running: !!t.timerStartedAt && localDate(t.timerStartedAt) === date });
      }
      if (rows.length) out.push({ date, rows, total: rows.reduce((a, r) => a + r.display, 0) });
    }
    return out;
  }
  function copyRow(row, fmt) {
    return `${row.title}${row.clientTag ? ` (${row.clientTag})` : ''}: ${formatTimeValue(row.display, fmt)}`;
  }
  function copyDay(day, fmt) {
    return [fmtDay(day.date), ...day.rows.map(r => copyRow(r, fmt)), `Total: ${formatTimeValue(day.total, fmt)}`].join('\n');
  }
  function copyWeek(days, fmt) {
    const total = days.reduce((a, d) => a + d.total, 0);
    return [...days.map(d => copyDay(d, fmt)), `Week total: ${formatTimeValue(total, fmt)}`].join('\n\n');
  }

  /* ---------- recurrence ---------- */
  function nextDue(iso, recurrence, anchorDay) {
    if (recurrence === 'weekly') return addDays(iso, 7);
    const d = parseDay(iso);
    const anchor = anchorDay || d.getDate();
    const lastOfNext = new Date(d.getFullYear(), d.getMonth() + 2, 0).getDate();
    return isoOf(new Date(d.getFullYear(), d.getMonth() + 1, Math.min(anchor, lastOfNext)));
  }
  function spawnRecurring(t, today) {
    let due = t.due || today;
    do { due = nextDue(due, t.recurrence, t.recurrenceAnchorDay); } while (due <= today);
    const gap = t.start && t.due ? daysBetween(t.start, t.due) : null;
    const now = new Date().toISOString();
    return {
      ...JSON.parse(JSON.stringify(t)),
      id: uid(), due, start: gap == null ? null : addDays(due, -gap), status: 'progress', position: null, rank: null, listRank: null,
      star: false, tucked: false, recurrenceSpawned: false, timeSessions: [], timerStartedAt: null, loggedDays: {},
      templatePrompted: true, completedAt: null, createdAt: now, updatedAt: now, legacy: null,
      subtasks: (t.subtasks || []).map(s => ({ id: uid(), name: s.name, done: false })),
    };
  }

  /* ---------- calendar ---------- */
  function taskRange(t) {
    const a = t.start || t.due, b = t.due || t.start;
    if (!a) return null;
    return a <= b ? { from: a, to: b } : { from: b, to: a };
  }
  function shiftDates(t, n) {
    return { start: t.start ? addDays(t.start, n) : null, due: t.due ? addDays(t.due, n) : null };
  }
  function layoutWeek(days, tasks) {
    const first = days[0], last = days[days.length - 1];
    const items = tasks.map(task => ({ task, r: taskRange(task) }))
      .filter(x => x.r && x.r.from <= last && x.r.to >= first)
      .sort((a, b) => a.r.from.localeCompare(b.r.from) || b.r.to.localeCompare(a.r.to));
    const laneEnd = [];
    return items.map(({ task, r }) => {
      const from = r.from < first ? first : r.from;
      const to = r.to > last ? last : r.to;
      const col = days.indexOf(from), span = days.indexOf(to) - col + 1;
      let lane = laneEnd.findIndex(end => end < col);
      if (lane < 0) { lane = laneEnd.length; laneEnd.push(0); }
      laneEnd[lane] = col + span - 1;
      return { task, col, span, lane, continuesLeft: r.from < first, continuesRight: r.to > last };
    });
  }

  /* ---------- board layout ---------- */
  function findFreeSpot(rects, view, size, gap = 20) {
    const hits = (x, y) => rects.some(r => x < r.x + r.w + gap && x + size.w + gap > r.x && y < r.y + r.h + gap && y + size.h + gap > r.y);
    const maxX = view.x + view.w - size.w - gap, maxY = view.y + view.h - size.h - gap;
    for (let y = view.y + gap; y <= maxY; y += 30) {
      for (let x = view.x + gap; x <= maxX; x += 30) if (!hits(x, y)) return { x: Math.round(x), y: Math.round(y) };
    }
    const n = rects.length % 12;
    return { x: Math.round(view.x + gap + n * 24), y: Math.round(view.y + gap + n * 24) };
  }
  const COLOR_ORDER = Object.keys(COLORS);
  function createdTime(t) {
    const when = Date.parse(t.createdAt);
    return Number.isNaN(when) ? Infinity : when;
  }
  function byCreated(a, b) {
    const x = createdTime(a), y = createdTime(b);
    return x === y ? 0 : x < y ? -1 : 1;
  }
  function tidyOrder(tasks) {
    return [...tasks].sort((a, b) =>
      PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) ||
      (a.due || '9999').localeCompare(b.due || '9999') ||
      (a.dueTime || '99').localeCompare(b.dueTime || '99') ||
      COLOR_ORDER.indexOf(a.color) - COLOR_ORDER.indexOf(b.color) ||
      byCreated(a, b) ||
      a.title.localeCompare(b.title));
  }
  /* Lays notes out in reading order, in rows, with each priority starting its own row. */
  function tidyLayout(tasks, heightOf, area, noteW, gap = 24, widthOf) {
    const out = {};
    let x = area.x, y = area.y, rowHeight = 0, priority = null;
    for (const t of tidyOrder(tasks)) {
      const w = widthOf ? widthOf(t.id) : noteW, h = heightOf(t.id);
      const wraps = x > area.x && x + w > area.x + area.w;
      if (wraps || (priority !== null && t.priority !== priority)) {
        y += rowHeight + gap;
        x = area.x;
        rowHeight = 0;
      }
      out[t.id] = { x, y };
      x += w + gap;
      rowHeight = Math.max(rowHeight, h);
      priority = t.priority;
    }
    return out;
  }
  /* ---------- areas: labelled parts of the board ---------- */
  const AREA_PAD = 20, AREA_HEAD = 46, AREA_MIN_W = 320, AREA_MIN_H = 180;
  function newArea(o) {
    return { id: uid(), ownerId: null, name: '', x: 0, y: 0, w: 928, h: 360, ...(o || {}) };
  }
  function cleanArea(a) {
    const n = newArea(a);
    if (!['x', 'y', 'w', 'h'].every(k => Number.isFinite(n[k]))) return null;
    n.name = String(n.name || '');
    n.w = Math.max(AREA_MIN_W, n.w);
    n.h = Math.max(AREA_MIN_H, n.h);
    return n;
  }
  /* The area at a point. Where areas overlap, the smaller one is the more specific. */
  function areaAt(areas, x, y) {
    const hits = areas.filter(a => x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h);
    return hits.sort((a, b) => a.w * a.h - b.w * b.h)[0] || null;
  }
  /* Which area each note belongs to, going by where its centre sits. */
  function assignAreas(tasks, areas, heightOf, widthOf) {
    const out = {};
    for (const t of tasks) {
      const a = t.position ? areaAt(areas, t.position.x + widthOf(t.id) / 2, t.position.y + heightOf(t.id) / 2) : null;
      out[t.id] = a ? a.id : null;
    }
    return out;
  }
  function areaForClient(areas, tag) {
    const name = String(tag || '').trim().toLowerCase();
    return name ? areas.find(a => a.name.trim().toLowerCase() === name) || null : null;
  }
  /* The size an area needs so a note sits fully inside it. */
  function grownArea(area, rect) {
    return {
      w: Math.max(area.w, rect.x + rect.w + AREA_PAD - area.x),
      h: Math.max(area.h, rect.y + rect.h + AREA_PAD - area.y),
    };
  }
  /* Tidies notes inside their areas and the rest underneath. Areas keep their place, unless one has grown into another. */
  function tidyBoard(tasks, areas, heightOf, widthOf, view, assign, gap = 24) {
    const positions = {}, placed = [];
    for (const a of [...areas].sort((p, q) => p.y - q.y || p.x - q.x)) {
      const members = tasks.filter(t => assign[t.id] === a.id);
      const next = { ...a, w: Math.max(a.w, members.reduce((m, t) => Math.max(m, widthOf(t.id)), 0) + AREA_PAD * 2) };
      for (const p of placed) {
        if (next.x < p.x + p.w && next.x + next.w > p.x && next.y < p.y + p.h + gap) next.y = p.y + p.h + gap;
      }
      const top = next.y + AREA_HEAD;
      const inside = tidyLayout(members, heightOf, { x: next.x + AREA_PAD, y: top, w: next.w - AREA_PAD * 2 }, NOTE_W, gap, widthOf);
      Object.assign(positions, inside);
      const bottom = members.reduce((m, t) => Math.max(m, inside[t.id].y + heightOf(t.id)), top);
      next.h = Math.max(next.h, bottom + AREA_PAD - next.y);
      placed.push(next);
    }
    const loose = tasks.filter(t => !placed.some(a => a.id === assign[t.id]));
    const start = placed.length
      ? { x: Math.min(...placed.map(a => a.x)), y: Math.max(...placed.map(a => a.y + a.h)) + gap * 2, w: view.w }
      : view;
    Object.assign(positions, tidyLayout(loose, heightOf, start, NOTE_W, gap, widthOf));
    return { positions, areas: areas.map(a => placed.find(p => p.id === a.id)) };
  }
  /* One area for each client on the board, reusing any that already exist. New ones are sized to their notes and flow across in rows. */
  function clientAreas(tasks, areas, opts) {
    const out = [...areas], assign = {}, gap = 24;
    const left = Math.round(opts.x), limit = Math.max(1300, opts.w);
    let x = left, y = Math.round(areas.length ? Math.max(...areas.map(a => a.y + a.h)) + 48 : opts.y), created = 0;
    for (const tag of clientTags(tasks)) {
      const members = tasks.filter(t => (t.clientTag || '').trim().toLowerCase() === tag.toLowerCase());
      let area = areaForClient(out, tag);
      if (!area) {
        const across = Math.min(3, Math.max(2, members.length));
        const w = across * NOTE_W + (across - 1) * gap + AREA_PAD * 2;
        if (x > left && x + w > left + limit) { x = left; y += AREA_MIN_H + gap; }
        area = newArea({ ownerId: opts.ownerId, name: tag, x, y, w, h: AREA_MIN_H });
        out.push(area);
        x += w + gap;
        created++;
      }
      for (const t of members) assign[t.id] = area.id;
    }
    return { areas: out, assign, created };
  }
  /* A small tilt that stays the same for each note. */
  function noteTilt(id) {
    let hash = 7;
    for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) % 9973;
    return Math.round(((hash % 29) - 14)) / 10;
  }
  /* The list's own arrangement: anything new comes first, then the order you chose. */
  function listOrder(tasks) {
    const open = tasks.filter(t => !isDone(t));
    const fresh = tidyOrder(open.filter(t => !Number.isFinite(t.listRank)));
    const placed = open.filter(t => Number.isFinite(t.listRank)).sort((a, b) => a.listRank - b.listRank);
    return [...fresh, ...placed];
  }
  /* Puts one task at the top of the list, fixing the order of everything else as it stands. */
  function rankFirst(tasks, first) {
    listOrder(tasks.filter(t => t !== first)).forEach((t, i) => { t.listRank = i + 1; });
    first.listRank = 0;
  }
  function reorderIds(all, id, beforeId, afterId) {
    if (beforeId === id) return [...all];
    const rest = all.filter(x => x !== id);
    let at = rest.length;
    if (beforeId && rest.includes(beforeId)) at = rest.indexOf(beforeId);
    else if (afterId && rest.includes(afterId)) at = rest.indexOf(afterId) + 1;
    rest.splice(at, 0, id);
    return rest;
  }

  /* ---------- templates ---------- */
  function makeTemplate(t, name) {
    return {
      id: uid(), ownerId: t.ownerId, name: name || t.title, title: t.title, desc: t.desc || '', priority: t.priority,
      clientTag: t.clientTag || '', service: t.service || '', color: t.color,
      subtasks: (t.subtasks || []).map(s => s.name),
    };
  }
  function taskFromTemplate(tpl, extra) {
    const { id, name, subtasks, ...rest } = tpl;
    return newTask({
      ...rest, ...(extra || {}), templatePrompted: true,
      subtasks: (subtasks || []).map(s => ({ id: uid(), name: typeof s === 'string' ? s : s.name, done: false })),
    });
  }

  /* ---------- saved data ---------- */
  function detectKind(raw) {
    if (Array.isArray(raw)) return raw.length === 0 || (raw[0] && typeof raw[0] === 'object') ? 'v04' : null;
    if (!raw || typeof raw !== 'object') return null;
    if (raw.app === 'Taskmaster' && raw.version) return 'v1';
    if (Array.isArray(raw.clients) || Array.isArray(raw.tasks)) return 'v04';
    return null;
  }
  function normalizeTask(t) {
    const n = newTask(t);
    if (!PRIORITIES.includes(n.priority)) n.priority = 'medium';
    if (!STATUSES.includes(n.status)) n.status = 'progress';
    if (!COLORS[n.color]) n.color = 'yellow';
    n.size = cleanSize(n.size);
    if (!Array.isArray(n.subtasks)) n.subtasks = [];
    if (!Array.isArray(n.timeSessions)) n.timeSessions = [];
    if (!n.loggedDays || typeof n.loggedDays !== 'object') n.loggedDays = {};
    if (!isISODate(n.due)) n.due = null;
    if (!n.due || !isClockTime(n.dueTime)) n.dueTime = null;
    if (!isISODate(n.start)) n.start = null;
    if (!(n.position && Number.isFinite(n.position.x) && Number.isFinite(n.position.y))) n.position = null;
    return n;
  }
  function cleanPrefs(raw) {
    const prefs = { ...DEFAULT_PREFS, ...(raw || {}) };
    if (!VIEWS[prefs.defaultView]) prefs.defaultView = DEFAULT_PREFS.defaultView;
    if (!['order', 'date'].includes(prefs.listSort)) prefs.listSort = DEFAULT_PREFS.listSort;
    if (!THEMES[prefs.theme]) prefs.theme = DEFAULT_PREFS.theme;
    return prefs;
  }
  function normalizeData(raw) {
    const owner = raw.owner && raw.owner.id ? { id: raw.owner.id, name: String(raw.owner.name || '') } : { id: uid(), name: String((raw.owner && raw.owner.name) || '') };
    const data = {
      app: 'Taskmaster', version: 1, savedAt: raw.savedAt || null, owner,
      tasks: (Array.isArray(raw.tasks) ? raw.tasks : []).filter(x => x && typeof x === 'object').map(normalizeTask),
      notes: (Array.isArray(raw.notes) ? raw.notes : []).filter(x => x && typeof x === 'object').map(n => newNote(n)),
      templates: (Array.isArray(raw.templates) ? raw.templates : []).filter(x => x && typeof x === 'object'),
      areas: (Array.isArray(raw.areas) ? raw.areas : []).filter(x => x && typeof x === 'object').map(cleanArea).filter(Boolean),
      prefs: cleanPrefs(raw.prefs),
    };
    data.clients = cleanClients(raw.clients, [...data.tasks, ...data.notes, ...data.templates], owner.id);
    return data;
  }
  function emptyData(name) {
    return normalizeData({ owner: { id: uid(), name: name || '' } });
  }
  function parseDataFile(text) {
    let raw;
    try { raw = JSON.parse(text); } catch (e) { throw new Error('This data file could not be read because its contents are damaged.'); }
    if (detectKind(raw) !== 'v1') throw new Error('This is not a Taskmaster 1.0 data file.');
    return normalizeData(raw);
  }
  function serialize(data) {
    return JSON.stringify({ ...data, savedAt: new Date().toISOString() }, null, 2);
  }

  /* ---------- importing from Taskmaster 0.4 ---------- */
  const LEGACY_FIELDS = ['kind', 'participants', 'approvals', 'reminderAt', 'followUpDate', 'createdBy', 'delegatedBy', 'delegatedByName', 'delegationNote', 'calendarMonth', 'calendarUrl', 'calendarSynced', 'ownerLinked', 'focusTodayBy', 'recurrenceOf', 'resetProgress', 'clientId', 'assignee', 'pinned', 'pinnedPosition'];
  function legacyOf(t) {
    const out = {};
    for (const k of LEGACY_FIELDS) {
      const v = t[k];
      if (v == null || v === false || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)) continue;
      out[k] = v;
    }
    return Object.keys(out).length ? out : null;
  }
  function migrateV04(raw, opts) {
    const { ownerId, ownerName = '', existingTaskIds = [], existingNoteIds = [] } = opts;
    const clients = Array.isArray(raw) ? raw : (Array.isArray(raw.clients) ? raw.clients : []);
    const sourceTasks = Array.isArray(raw.tasks) ? raw.tasks.slice() : [];
    const clientName = new Map(clients.map(c => [c.id, String(c.name || '')]));
    for (const c of clients) {
      for (const lt of Array.isArray(c.todos) ? c.todos : []) {
        if (sourceTasks.some(t => t.id === lt.id)) continue;
        sourceTasks.push({ id: lt.id, name: lt.text || 'Task', due: lt.deadline || null, state: lt.done ? 'approved' : 'progress', created: lt.deadline, completedAt: lt.done ? lt.deadline : null, clientId: c.id, priority: 'normal' });
      }
    }
    const taken = new Set(existingTaskIds), takenNotes = new Set(existingNoteIds);
    const me = String(ownerName).trim().toLowerCase();
    const running = sourceTasks.filter(t => t && typeof t.timerStartedAt === 'string' && Number.isFinite(Date.parse(t.timerStartedAt)))
      .sort((a, b) => Date.parse(b.timerStartedAt) - Date.parse(a.timerStartedAt))[0];
    const tasks = [];
    let alreadyImported = 0;
    for (const t of sourceTasks) {
      if (!t || typeof t !== 'object') continue;
      if (t.id && taken.has(t.id)) { alreadyImported++; continue; }
      const state = t.state === 'review' ? 'waiting' : ['done', 'complete'].includes(t.state) ? 'approved' : t.state;
      const finished = state === 'approved' || !!t.archived;
      const assignee = t.assignee ? String(t.assignee).trim() : '';
      const legacy = legacyOf(t);
      const desc = [t.desc ? String(t.desc) : '', t.calendarUrl ? `Calendar link: ${t.calendarUrl}` : ''].filter(Boolean).join('\n\n');
      const pos = t.notePosition && Number.isFinite(t.notePosition.x) && Number.isFinite(t.notePosition.y) ? { x: t.notePosition.x, y: t.notePosition.y } : null;
      tasks.push(newTask({
        id: t.id || uid(), ownerId,
        title: String(t.name || 'Untitled task'), desc,
        priority: t.priority === 'normal' ? 'medium' : ['high', 'low'].includes(t.priority) ? t.priority : ['important', 'urgent'].includes(t.priority) ? 'high' : 'medium',
        status: finished ? 'done' : state === 'waiting' ? 'waiting' : 'progress',
        color: t.color && t.color !== 'none' && COLORS[t.color] ? t.color : 'white',
        due: localDate(t.due), clientTag: clientName.get(t.clientId) || '',
        service: SERVICES[t.service] ? t.service : '',
        withName: assignee && assignee.toLowerCase() !== me ? assignee : '',
        waitingOn: t.waitingOn ? String(t.waitingOn) : '',
        subtasks: (Array.isArray(t.subtasks) ? t.subtasks : []).filter(x => x && typeof x === 'object').map(x => ({ id: x.id || uid(), name: String(x.name || 'Subtask'), done: !!x.done })),
        position: pos,
        star: !!t.focusToday || (Array.isArray(t.focusTodayBy) && t.focusTodayBy.length > 0),
        tucked: !!t.stickyHidden,
        recurrence: ['weekly', 'monthly'].includes(t.recurrence) ? t.recurrence : 'none',
        recurrenceAnchorDay: Number.isInteger(t.recurrenceAnchorDay) ? t.recurrenceAnchorDay : null,
        recurrenceSpawned: !!t.recurrenceSpawned,
        timeSessions: (Array.isArray(t.timeSessions) ? t.timeSessions : []).filter(s => s && Number.isFinite(s.seconds) && s.seconds > 0 && typeof s.endedAt === 'string')
          .map(s => ({ id: uid(), startedAt: String(s.startedAt || s.endedAt), endedAt: s.endedAt, seconds: Math.round(s.seconds) })),
        timerStartedAt: t === running ? t.timerStartedAt : null,
        templatePrompted: true,
        createdAt: t.created || new Date().toISOString(),
        updatedAt: t.updatedAt || t.created || new Date().toISOString(),
        completedAt: finished ? (t.completedAt || t.archivedAt || t.updatedAt || null) : null,
        legacy,
      }));
    }
    const notes = [];
    for (const n of Array.isArray(raw.weeklyNotes) ? raw.weeklyNotes : []) {
      if (!n || typeof n !== 'object') continue;
      if (n.id && takenNotes.has(n.id)) { alreadyImported++; continue; }
      const body = [String(n.text || ''), n.response ? `Response: ${n.response}` : ''].filter(Boolean).join('\n\n');
      notes.push(newNote({ id: n.id || uid(), ownerId, title: 'Weekly note', date: localDate(n.createdAt) || todayISO(), body, createdAt: n.createdAt || new Date().toISOString() }));
    }
    const sessions = tasks.reduce((a, t) => a + t.timeSessions.length, 0);
    const seconds = tasks.reduce((a, t) => a + t.timeSessions.reduce((b, s) => b + s.seconds, 0), 0);
    return {
      tasks, notes,
      summary: {
        newTasks: tasks.length, open: tasks.filter(t => t.status !== 'done').length, done: tasks.filter(t => t.status === 'done').length,
        sessions, seconds, notes: notes.length, withOthers: tasks.filter(t => t.withName).length, alreadyImported,
      },
    };
  }

  const api = {
    COLORS, PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL, SERVICES, DAY_NAMES, MONTH_NAMES, MONTH_FULL, DEFAULT_PREFS,
    priorityBadge, addedLabel, noteTilt, listOrder, reorderIds, rankFirst,
    parseTimeEdit, setTrackedTime, findClient, addClient, clientStats, renameClient, removeClient,
    THEMES, quickValues, taskFromQuick, formatHours, hoursLabel, findTime,
    timerLooksForgotten, timerStopGuess, stopTimerAt, localDateTimeValue,
    AREA_PAD, AREA_HEAD, AREA_MIN_W, AREA_MIN_H, newArea, areaAt, assignAreas, areaForClient, grownArea, tidyBoard, clientAreas,
    VIEWS, listGroups, columnGroups, moveInOrder,
    NOTE_W, NOTE_MIN_W, NOTE_MAX_W, NOTE_MAX_H, noteWidth, noteTextScale, subtaskLimit,
    uid, esc, todayISO, localDate, addDays, daysBetween, weekStart, weekDays, monthGrid, fmtDay, dueLabel, isISODate,
    newTask, newNote, isDone, inTray, inFocus, isOverdue, previewSubtasks, clientTags,
    parseQuickAdd, parseDuration, formatDuration, formatClock, roundSeconds, formatTimeValue, taskSeconds, runningSeconds, pauseTimer,
    timeRows, copyRow, copyDay, copyWeek, spawnRecurring, taskRange, shiftDates, layoutWeek,
    findFreeSpot, tidyOrder, tidyLayout, makeTemplate, taskFromTemplate,
    detectKind, normalizeData, emptyData, parseDataFile, serialize, migrateV04,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TMCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
