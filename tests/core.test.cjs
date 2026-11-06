const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/core.js');

const THU = '2026-11-05'; // a Thursday
const local = (y, m, d, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).toISOString();
const task = (o = {}) => C.newTask({ title: 'T', ownerId: 'me', ...o });

test('date helpers use local Monday-first weeks', () => {
  assert.equal(C.weekStart(THU), '2026-11-02');
  assert.equal(C.weekStart('2026-11-08'), '2026-11-02');
  assert.equal(C.addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(C.localDate(local(2026, 11, 5, 23, 59)), THU);
  const g = C.monthGrid(2026, 11);
  assert.equal(g[0][0], '2026-10-26');
  assert.equal(g[g.length - 1][6], '2026-12-06');
  assert.ok(g.every(w => w.length === 7));
});

test('due labels', () => {
  assert.deepEqual(C.dueLabel(task({ due: THU }), THU), { text: 'Due today', kind: 'today' });
  assert.deepEqual(C.dueLabel(task({ due: '2026-11-04' }), THU), { text: '1 day late', kind: 'late' });
  assert.deepEqual(C.dueLabel(task({ due: '2026-11-01' }), THU), { text: '4 days late', kind: 'late' });
  assert.deepEqual(C.dueLabel(task({ due: '2026-11-06' }), THU), { text: 'Fri 6 Nov', kind: '' });
  assert.deepEqual(C.dueLabel(task({}), THU), { text: 'No date', kind: 'none' });
  assert.equal(C.dueLabel(task({ due: '2026-11-04', status: 'done' }), THU).kind, '');
});

test('quick add reads date, priority and client, and leaves the rest as the title', () => {
  const r = C.parseQuickAdd('Monthly report fri !high #clinic-b', { today: THU, clientTags: [] });
  assert.equal(r.title, 'Monthly report');
  assert.equal(r.due, '2026-11-06');
  assert.equal(r.priority, 'high');
  assert.equal(r.clientTag, 'clinic b');
});

test('quick add date forms', () => {
  const p = t => C.parseQuickAdd(t, { today: THU }).due;
  assert.equal(p('x today'), THU);
  assert.equal(p('x tomorrow'), '2026-11-06');
  assert.equal(p('x monday'), '2026-11-09');
  assert.equal(p('x thursday'), THU);
  assert.equal(p('x 12 nov'), '2026-11-12');
  assert.equal(p('x nov 12'), '2026-11-12');
  assert.equal(p('x 1 jan'), '2027-01-01');
  assert.equal(p('call tomorrow about ads'), '2026-11-06');
});

test('quick add leaves ordinary words in the title', () => {
  const r = C.parseQuickAdd('Review sun protection page', { today: THU });
  assert.equal(r.title, 'Review sun protection page');
  assert.equal(r.due, null);
  assert.equal(C.parseQuickAdd('May campaign', { today: THU }).due, null);
  assert.equal(C.parseQuickAdd('Fix !important css', { today: THU }).title, 'Fix !important css');
  assert.equal(C.parseQuickAdd('Report mon', { today: THU }).due, '2026-11-09');
});

test('removing a chip keeps its words in the title', () => {
  const r = C.parseQuickAdd('Call tomorrow !high', { today: THU, ignore: ['date'] });
  assert.equal(r.title, 'Call tomorrow');
  assert.equal(r.due, null);
  assert.equal(r.priority, 'high');
  const r2 = C.parseQuickAdd('Call !high', { today: THU, ignore: ['priority'] });
  assert.equal(r2.title, 'Call !high');
});

test('quick add matches multi-word client tags and templates', () => {
  const r = C.parseQuickAdd('Plan #harley street ads', { today: THU, clientTags: ['Harley Street'] });
  assert.equal(r.clientTag, 'Harley Street');
  assert.equal(r.title, 'Plan ads');
  const tpl = { id: 't1', name: 'Monthly report' };
  const r2 = C.parseQuickAdd('/monthly report fri', { today: THU, templates: [tpl] });
  assert.equal(r2.templateId, 't1');
  assert.equal(r2.title, '');
  assert.equal(r2.due, '2026-11-06');
});

test('durations parse and format', () => {
  assert.equal(C.parseDuration('1h 20m'), 4800);
  assert.equal(C.parseDuration('80m'), 4800);
  assert.equal(C.parseDuration('1.5h'), 5400);
  assert.equal(C.parseDuration('1:20'), 4800);
  assert.equal(C.parseDuration('45'), 2700);
  assert.equal(C.parseDuration('nonsense'), null);
  assert.equal(C.parseDuration('0'), null);
  assert.equal(C.formatDuration(12000), '3h 20m');
  assert.equal(C.formatDuration(2700), '45m');
  assert.equal(C.formatDuration(0), '0m');
  assert.equal(C.formatClock(2530), '0:42:10');
});

test('time formats and rounding', () => {
  assert.equal(C.formatTimeValue(4800, 'hm'), '1h 20m');
  assert.equal(C.formatTimeValue(4800, 'decimal'), '1.33');
  assert.equal(C.roundSeconds(4800, 15), 4500);
  assert.equal(C.roundSeconds(4800, 0), 4800);
  assert.equal(C.roundSeconds(60, 15), 900); // tracked work never rounds away to nothing
});

test('a running timer counts time without being stopped', () => {
  const now = new Date(2026, 10, 5, 12, 0);
  const t = task({ timeSessions: [{ startedAt: local(2026, 11, 5, 9), endedAt: local(2026, 11, 5, 10), seconds: 3600 }], timerStartedAt: local(2026, 11, 5, 11, 30) });
  assert.equal(C.taskSeconds(t, now), 5400);
});

test('time rows group by the day a session started, including past midnight', () => {
  const t = task({ title: 'Late', clientTag: 'Clinic A', timeSessions: [
    { startedAt: local(2026, 11, 5, 23, 30), endedAt: local(2026, 11, 6, 0, 30), seconds: 3600 },
    { startedAt: local(2026, 11, 6, 9), endedAt: local(2026, 11, 6, 9, 30), seconds: 1800 },
    { startedAt: local(2026, 10, 1, 9), endedAt: local(2026, 10, 1, 10), seconds: 3600 },
  ] });
  const days = C.timeRows([t], '2026-11-02', { now: new Date(2026, 10, 7), rounding: 0 });
  assert.equal(days.length, 2);
  assert.equal(days[0].date, THU);
  assert.equal(days[0].rows[0].seconds, 3600);
  assert.equal(days[1].date, '2026-11-06');
  assert.equal(days[1].total, 1800);
});

test('logged tick clears when more time is added afterwards', () => {
  const s = { startedAt: local(2026, 11, 5, 9), endedAt: local(2026, 11, 5, 10), seconds: 3600 };
  const t = task({ timeSessions: [s], loggedDays: { [THU]: 3600 } });
  const now = new Date(2026, 10, 6);
  assert.equal(C.timeRows([t], '2026-11-02', { now })[0].rows[0].logged, true);
  t.timeSessions.push({ ...s, seconds: 600 });
  const row = C.timeRows([t], '2026-11-02', { now })[0].rows[0];
  assert.equal(row.logged, false);
  assert.equal(row.loggedSeconds, 3600);
});

test('copy text', () => {
  const row = { title: 'Landing page copy', clientTag: 'Clinic A', display: 4800 };
  assert.equal(C.copyRow(row, 'hm'), 'Landing page copy (Clinic A): 1h 20m');
  assert.equal(C.copyRow({ ...row, clientTag: '' }, 'decimal'), 'Landing page copy: 1.33');
  const text = C.copyDay({ date: THU, rows: [row], total: 4800 }, 'hm');
  assert.match(text, /Thu 5 Nov/);
  assert.match(text, /Landing page copy \(Clinic A\): 1h 20m/);
  assert.match(text, /Total: 1h 20m/);
});

test('recurrence creates a fresh next task', () => {
  const t = task({ title: 'R', recurrence: 'monthly', recurrenceAnchorDay: 31, due: '2026-10-31', start: '2026-10-29', subtasks: [{ id: 'a', name: 'x', done: true }], timeSessions: [{ startedAt: 'a', endedAt: 'b', seconds: 5 }], loggedDays: { x: 1 } });
  const n = C.spawnRecurring(t, THU);
  assert.equal(n.due, '2026-11-30');
  assert.equal(n.start, '2026-11-28');
  assert.equal(n.subtasks[0].done, false);
  assert.notEqual(n.subtasks[0].id, 'a');
  assert.deepEqual(n.timeSessions, []);
  assert.equal(n.status, 'progress');
  assert.notEqual(n.id, t.id);
  const w = C.spawnRecurring(task({ recurrence: 'weekly', due: THU }), THU);
  assert.equal(w.due, '2026-11-12');
  assert.equal(C.spawnRecurring(task({ recurrence: 'weekly' }), THU).due, '2026-11-12');
});

test('calendar ranges, moving dates and lanes', () => {
  assert.deepEqual(C.taskRange(task({ due: THU })), { from: THU, to: THU });
  assert.deepEqual(C.taskRange(task({ start: '2026-11-03', due: THU })), { from: '2026-11-03', to: THU });
  assert.deepEqual(C.taskRange(task({ start: '2026-11-09', due: THU })), { from: THU, to: '2026-11-09' });
  assert.equal(C.taskRange(task({})), null);
  assert.deepEqual(C.shiftDates(task({ start: '2026-11-03', due: THU }), 2), { start: '2026-11-05', due: '2026-11-07' });
  assert.deepEqual(C.shiftDates(task({ due: THU }), -1), { start: null, due: '2026-11-04' });
  const week = Array.from({ length: 7 }, (_, i) => C.addDays('2026-11-02', i));
  const a = task({ start: '2026-10-30', due: '2026-11-03' }), b = task({ due: '2026-11-03' }), c = task({ due: '2026-11-05' });
  const segs = C.layoutWeek(week, [a, b, c]);
  const sa = segs.find(s => s.task === a), sb = segs.find(s => s.task === b), sc = segs.find(s => s.task === c);
  assert.deepEqual([sa.col, sa.span, sa.lane], [0, 2, 0]);
  assert.equal(sa.continuesLeft, true);
  assert.equal(sb.lane, 1);
  assert.equal(sc.lane, 0);
  assert.equal(C.layoutWeek(['2026-12-07'], [a]).length, 0);
});

test('free spot avoids existing notes and stays in view', () => {
  const view = { x: 0, y: 0, w: 800, h: 600 };
  const first = C.findFreeSpot([], view, { w: 230, h: 190 });
  assert.deepEqual(first, { x: 20, y: 20 });
  const second = C.findFreeSpot([{ x: 20, y: 20, w: 230, h: 190 }], view, { w: 230, h: 190 });
  assert.ok(second.x >= 250 || second.y >= 210);
  const full = [{ x: 0, y: 0, w: 800, h: 600 }];
  const fallback = C.findFreeSpot(full, view, { w: 230, h: 190 });
  assert.ok(Number.isFinite(fallback.x) && Number.isFinite(fallback.y));
});

test('tidy orders by priority then due date without overlaps', () => {
  const list = [
    task({ id: 'c', priority: 'low' }),
    task({ id: 'b', priority: 'high', due: '2026-11-09' }),
    task({ id: 'a', priority: 'high', due: THU }),
    task({ id: 'd', priority: 'medium' }),
  ];
  const h = { a: 300, b: 100, c: 100, d: 100 };
  const pos = C.tidyLayout(list, id => h[id], { x: 0, y: 0, w: 520 }, 230);
  assert.deepEqual(C.tidyOrder(list).map(t => t.id), ['a', 'b', 'd', 'c']);
  assert.equal(pos.a.y, 0);
  assert.equal(pos.a.x, 0);
  assert.equal(pos.b.y, 0);
  assert.notEqual(pos.b.x, pos.a.x);
  assert.ok(pos.d.y >= 100);
});

test('tidy keeps notes of different sizes from overlapping', () => {
  const list = [task({ id: 'a', priority: 'high', size: { w: 500, h: null } }), task({ id: 'b', priority: 'medium' }), task({ id: 'c', priority: 'low', size: { w: 200, h: null } }), task({ id: 'd', priority: 'low' })];
  const h = { a: 300, b: 150, c: 150, d: 200 };
  const pos = C.tidyLayout(list, id => h[id], { x: 10, y: 20, w: 900 }, 280, 24, id => C.noteWidth(list.find(t => t.id === id)));
  const r = list.map(t => ({ ...pos[t.id], w: C.noteWidth(t), h: h[t.id] }));
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
    const apart = r[i].x + r[i].w <= r[j].x || r[j].x + r[j].w <= r[i].x || r[i].y + r[i].h <= r[j].y || r[j].y + r[j].h <= r[i].y;
    assert.ok(apart, `notes ${i} and ${j} overlap`);
  }
  assert.deepEqual([pos.a.x, pos.a.y], [10, 20]);
});

test('note sizes', () => {
  assert.equal(C.noteWidth(task({})), 280);
  assert.equal(C.noteWidth(task({ size: { w: 420, h: null } })), 420);
  assert.equal(C.noteWidth(task({ size: { w: 5000, h: null } })), C.NOTE_MAX_W);
  assert.equal(C.noteWidth(task({ size: { w: 1, h: null } })), C.NOTE_MIN_W);
  assert.equal(C.noteTextScale(280), 1);
  assert.equal(C.noteTextScale(560), 2);
  assert.equal(C.noteTextScale(190), 0.85); // small notes stay readable
  assert.equal(C.subtaskLimit(280), 3);
  assert.ok(C.subtaskLimit(420) > 3);
  assert.ok(C.subtaskLimit(560) >= C.subtaskLimit(420));
});

test('saved sizes are checked when loading, and older files still load', () => {
  const load = size => C.parseDataFile(JSON.stringify({ app: 'Taskmaster', version: 1, owner: { id: 'x', name: 'A' }, tasks: [{ id: '1', title: 'a', ...(size === undefined ? {} : { size }) }] })).tasks[0].size;
  assert.equal(load(undefined), null);
  assert.equal(load('nonsense'), null);
  assert.equal(load({ w: 'wide' }), null);
  assert.deepEqual(load({ w: 400, h: 500 }), { w: 400, h: 500 });
  assert.deepEqual(load({ w: 9999, h: -3 }), { w: C.NOTE_MAX_W, h: null });
});

test('note preview shows open subtasks first but keeps list order', () => {
  const s = ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({ id, name: id, done: i < 2 }));
  assert.deepEqual(C.previewSubtasks(s).shown.map(x => x.id), ['c', 'd', 'e']);
  assert.equal(C.previewSubtasks(s).more, 2);
  const s2 = [{ id: 'a', done: true }, { id: 'b', done: true }, { id: 'c', done: false }];
  assert.deepEqual(C.previewSubtasks(s2).shown.map(x => x.id), ['a', 'b', 'c']);
});

test('finished tasks go straight to the Done tray', () => {
  assert.equal(C.inTray(task({ status: 'done', completedAt: local(2026, 11, 5, 9) }), THU), true);
  assert.equal(C.inTray(task({ status: 'done', completedAt: local(2026, 11, 4, 9) }), THU), true);
  assert.equal(C.inTray(task({ status: 'waiting' }), THU), false);
  assert.equal(C.inTray(task({ status: 'progress' }), THU), false);
});

test('list view groups open tasks by date, most urgent first', () => {
  const list = [
    task({ id: 'none', priority: 'high' }),
    task({ id: 'late', due: '2026-11-01' }),
    task({ id: 'todayLow', due: THU, priority: 'low' }),
    task({ id: 'todayHigh', due: THU, priority: 'high' }),
    task({ id: 'soon', due: '2026-11-12' }),
    task({ id: 'far', due: '2026-11-13' }),
    task({ id: 'finished', due: THU, status: 'done', completedAt: THU }),
  ];
  const groups = C.listGroups(list, THU);
  assert.deepEqual(groups.map(g => g.key), ['overdue', 'today', 'soon', 'later', 'none']);
  assert.deepEqual(groups[1].items.map(t => t.id), ['todayHigh', 'todayLow']);
  assert.equal(groups[2].items[0].id, 'soon');
  assert.equal(groups.flatMap(g => g.items).some(t => t.id === 'finished'), false);
  assert.deepEqual(C.listGroups([task({ id: 'a' })], THU).map(g => g.key), ['none']);
});

test('columns view sorts by chosen order, and Done shows today only', () => {
  const list = [
    task({ id: 'b', rank: 1 }),
    task({ id: 'a', rank: 0 }),
    task({ id: 'new', priority: 'high' }),
    task({ id: 'w', status: 'waiting' }),
    task({ id: 'd1', status: 'done', completedAt: local(2026, 11, 5, 9) }),
    task({ id: 'd2', status: 'done', completedAt: local(2026, 11, 5, 11) }),
    task({ id: 'old', status: 'done', completedAt: local(2026, 11, 1, 9) }),
  ];
  const c = C.columnGroups(list, THU);
  assert.deepEqual(c.map(x => x.key), ['progress', 'waiting', 'done']);
  assert.deepEqual(c[0].items.map(t => t.id), ['a', 'b', 'new']);
  assert.deepEqual(c[1].items.map(t => t.id), ['w']);
  assert.deepEqual(c[2].items.map(t => t.id), ['d2', 'd1']);
  assert.equal(c[2].earlier, 1);
});

test('moving a card within an order', () => {
  assert.deepEqual(C.moveInOrder(['a', 'b', 'c'], 'a', 2), ['b', 'c', 'a']);
  assert.deepEqual(C.moveInOrder(['a', 'b', 'c'], 'c', 0), ['c', 'a', 'b']);
  assert.deepEqual(C.moveInOrder(['a', 'b'], 'x', 1), ['a', 'x', 'b']);
  assert.deepEqual(C.moveInOrder(['a', 'b'], 'x', 99), ['a', 'b', 'x']);
});

test('view preferences are checked when loading', () => {
  const load = prefs => C.parseDataFile(JSON.stringify({ app: 'Taskmaster', version: 1, owner: { id: 'x', name: 'A' }, tasks: [], prefs })).prefs;
  assert.equal(load({}).defaultView, 'sticky');
  assert.equal(load({}).effects, true);
  assert.equal(load({ defaultView: 'columns' }).defaultView, 'columns');
  assert.equal(load({ defaultView: 'nonsense' }).defaultView, 'sticky');
});

test('today focus includes starred, due today and overdue', () => {
  assert.equal(C.inFocus(task({ star: true }), THU), true);
  assert.equal(C.inFocus(task({ due: THU }), THU), true);
  assert.equal(C.inFocus(task({ due: '2026-11-01' }), THU), true);
  assert.equal(C.inFocus(task({ due: '2026-11-09' }), THU), false);
  assert.equal(C.inFocus(task({ due: '2026-11-01', status: 'done', completedAt: THU }), THU), false);
});

const v04 = () => ({
  app: 'OMD - Taskmaster',
  settings: {},
  weeklyNotes: [{ id: 'w1', text: 'Discuss budget', response: 'Agreed', week: '2026-W40', createdAt: local(2026, 10, 1, 9), authorName: 'Pavle' }],
  clients: [{ id: 'c1', name: 'Clinic A', todos: [{ id: 'old1', text: 'Old todo', deadline: '2026-09-01', done: false }] }],
  tasks: [
    { id: 't1', name: 'Open <task>', desc: 'd', due: THU, state: 'progress', priority: 'normal', color: 'pink', notePosition: { x: 1834, y: 587 }, clientId: 'c1', service: 'paid', assignee: 'Pavle', created: '2026-10-01', subtasks: [{ id: 's', name: 'sub', done: true }], timeSessions: [{ startedAt: local(2026, 10, 1, 9), endedAt: local(2026, 10, 1, 10), seconds: 3600 }], focusToday: true },
    { id: 't2', name: 'Theirs', state: 'approved', priority: 'high', color: 'none', assignee: 'Tania', completedAt: '2026-10-02', service: 'personal' },
    { id: 't3', name: 'Waiting', state: 'waiting', priority: 'low', waitingOn: 'Client', kind: 'group', participants: ['a'], reminderAt: 'x', calendarMonth: '2026-11', calendarUrl: 'https://example.com/c', archived: true, archivedAt: '2026-10-05', updatedAt: '2026-10-05' },
    { id: 't4', state: 'review', priority: 'urgent', color: 'unknown', stickyHidden: true },
  ],
});

test('V0.4 import maps fields', () => {
  const { tasks, notes, summary } = C.migrateV04(v04(), { ownerId: 'me', ownerName: 'pavle' });
  const by = id => tasks.find(t => t.id === id);
  const t1 = by('t1');
  assert.equal(t1.title, 'Open <task>');
  assert.equal(t1.priority, 'medium');
  assert.equal(t1.color, 'pink');
  assert.deepEqual(t1.position, { x: 1834, y: 587 });
  assert.equal(t1.clientTag, 'Clinic A');
  assert.equal(t1.withName, '');
  assert.equal(t1.star, true);
  assert.equal(t1.ownerId, 'me');
  assert.equal(t1.templatePrompted, true);
  assert.equal(t1.timeSessions[0].seconds, 3600);
  const t2 = by('t2');
  assert.equal(t2.status, 'done');
  assert.equal(t2.color, 'white');
  assert.equal(t2.withName, 'Tania');
  const t3 = by('t3');
  assert.equal(t3.status, 'done');
  assert.equal(t3.completedAt, '2026-10-05');
  assert.equal(t3.waitingOn, 'Client');
  assert.match(t3.desc, /https:\/\/example.com\/c/);
  assert.equal(t3.legacy.kind, 'group');
  assert.equal(t3.legacy.reminderAt, 'x');
  const t4 = by('t4');
  assert.equal(t4.status, 'waiting');
  assert.equal(t4.priority, 'high');
  assert.equal(t4.title, 'Untitled task');
  assert.equal(t4.tucked, true);
  assert.equal(by('old1').clientTag, 'Clinic A');
  assert.equal(by('old1').due, '2026-09-01');
  assert.equal(notes.length, 1);
  assert.match(notes[0].body, /Discuss budget/);
  assert.match(notes[0].body, /Agreed/);
  assert.equal(notes[0].date, '2026-10-01');
  assert.equal(summary.newTasks, 5);
  assert.equal(summary.sessions, 1);
  assert.equal(summary.seconds, 3600);
  assert.equal(summary.withOthers, 1);
});

test('V0.4 import does not change the source and does not duplicate', () => {
  const raw = v04(), before = JSON.stringify(raw);
  const first = C.migrateV04(raw, { ownerId: 'me', ownerName: 'Pavle' });
  assert.equal(JSON.stringify(raw), before);
  const again = C.migrateV04(raw, { ownerId: 'me', ownerName: 'Pavle', existingTaskIds: first.tasks.map(t => t.id), existingNoteIds: first.notes.map(n => n.id) });
  assert.equal(again.tasks.length, 0);
  assert.equal(again.notes.length, 0);
  assert.equal(again.summary.alreadyImported, 6);
});

test('V0.4 import keeps only the newest running timer', () => {
  const raw = v04();
  raw.tasks[0].timerStartedAt = local(2026, 11, 5, 9);
  raw.tasks[1].timerStartedAt = local(2026, 11, 5, 10);
  const { tasks } = C.migrateV04(raw, { ownerId: 'me', ownerName: 'Pavle' });
  assert.equal(tasks.filter(t => t.timerStartedAt).length, 1);
  assert.equal(tasks.find(t => t.id === 't2').timerStartedAt, local(2026, 11, 5, 10));
});

test('file kind detection and validation', () => {
  assert.equal(C.detectKind(v04()), 'v04');
  assert.equal(C.detectKind([{ id: 'c', name: 'x' }]), 'v04');
  assert.equal(C.detectKind({ app: 'Taskmaster', version: 1, tasks: [] }), 'v1');
  assert.equal(C.detectKind({ hello: 1 }), null);
  assert.throws(() => C.parseDataFile('{not json'), /could not be read/i);
  assert.throws(() => C.parseDataFile('{"hello":1}'), /not a Taskmaster/i);
  const d = C.parseDataFile(JSON.stringify({ app: 'Taskmaster', version: 1, owner: { id: 'x', name: 'A' }, tasks: [{ id: '1', title: 'a' }] }));
  assert.equal(d.tasks[0].priority, 'medium');
  assert.equal(d.tasks[0].color, 'yellow');
  assert.equal(d.prefs.calendar, 'off');
  assert.deepEqual(d.notes, []);
});

test('templates hold reusable parts only', () => {
  const t = task({ title: 'Report', desc: 'd', priority: 'high', clientTag: 'A', color: 'pink', due: THU, start: THU, subtasks: [{ id: 's', name: 'x', done: true }], timeSessions: [{ seconds: 5 }] });
  const tpl = C.makeTemplate(t, 'Report tpl');
  assert.equal(tpl.name, 'Report tpl');
  assert.equal(tpl.due, undefined);
  assert.equal(tpl.timeSessions, undefined);
  const n = C.taskFromTemplate(tpl, { ownerId: 'me', due: THU });
  assert.equal(n.title, 'Report');
  assert.equal(n.due, THU);
  assert.equal(n.subtasks[0].done, false);
  assert.notEqual(n.subtasks[0].id, 's');
  assert.equal(n.templatePrompted, true);
  assert.equal(n.color, 'pink');
});

test('ordinary tasks show no priority label', () => {
  assert.equal(C.PRIORITY_LABEL.medium, 'Normal');
  assert.equal(C.priorityBadge(task({ priority: 'medium' })), '');
  assert.match(C.priorityBadge(task({ priority: 'high' })), /High/);
  assert.match(C.priorityBadge(task({ priority: 'low' })), /Low/);
  assert.equal(task({}).priority, 'medium');
});

test('added label shows when a task was created', () => {
  assert.equal(C.addedLabel(task({ createdAt: local(2026, 11, 5, 14, 7) }), THU), 'Added today, 14:07');
  assert.equal(C.addedLabel(task({ createdAt: local(2026, 11, 4, 9, 0) }), THU), 'Added yesterday, 09:00');
  assert.equal(C.addedLabel(task({ createdAt: local(2026, 10, 1, 9, 30) }), THU), 'Added 1 Oct, 09:30');
  assert.equal(C.addedLabel(task({ createdAt: local(2025, 10, 1, 9, 30) }), THU), 'Added 1 Oct 2025, 09:30');
  assert.equal(C.addedLabel(task({ createdAt: '2026-10-01' }), THU), 'Added 1 Oct'); // older tasks only stored a date
  assert.equal(C.addedLabel(task({ createdAt: 'nonsense' }), THU), '');
  assert.equal(C.addedLabel(task({ createdAt: null }), THU), '');
});

test('more note colours, and saved ones still load', () => {
  for (const c of ['yellow', 'pink', 'peach', 'green', 'blue', 'lavender', 'white', 'mint', 'teal', 'coral', 'sand']) assert.ok(C.COLORS[c], c);
  const d = C.parseDataFile(JSON.stringify({ app: 'Taskmaster', version: 1, owner: { id: 'x', name: 'A' }, tasks: [{ id: '1', title: 'a', color: 'coral' }, { id: '2', title: 'b', color: 'gone' }] }));
  assert.equal(d.tasks[0].color, 'coral');
  assert.equal(d.tasks[1].color, 'yellow');
});

test('tidy order: priority, then due date, then colour, then creation time', () => {
  const list = [
    task({ id: 'low', priority: 'low', due: '2026-11-01' }),
    task({ id: 'nodate', priority: 'high' }),
    task({ id: 'late', priority: 'high', due: '2026-11-09' }),
    task({ id: 'blue', priority: 'high', due: THU, color: 'blue', createdAt: local(2026, 1, 1, 9) }),
    task({ id: 'yNew', priority: 'high', due: THU, color: 'yellow', createdAt: local(2026, 11, 2, 9) }),
    task({ id: 'yOld', priority: 'high', due: THU, color: 'yellow', createdAt: local(2026, 10, 2, 9) }),
    task({ id: 'yDateOnly', priority: 'high', due: THU, color: 'yellow', createdAt: '2026-09-02' }),
    task({ id: 'normal', priority: 'medium', due: '2026-11-02' }),
  ];
  assert.deepEqual(C.tidyOrder(list).map(t => t.id), ['yDateOnly', 'yOld', 'yNew', 'blue', 'late', 'nodate', 'normal', 'low']);
});

test('tidy layout reads in sorted order, with a new row for each priority', () => {
  const list = [task({ id: 'h1', priority: 'high' }), task({ id: 'h2', priority: 'high' }), task({ id: 'h3', priority: 'high' }), task({ id: 'n1' }), task({ id: 'l1', priority: 'low' })];
  const h = { h1: 300, h2: 100, h3: 100, n1: 100, l1: 100 };
  const pos = C.tidyLayout(list, id => h[id], { x: 0, y: 0, w: 520 }, 230);
  assert.deepEqual(pos.h1, { x: 0, y: 0 });
  assert.deepEqual(pos.h2, { x: 254, y: 0 });
  assert.deepEqual(pos.h3, { x: 0, y: 324 });
  assert.deepEqual(pos.n1, { x: 0, y: 448 });
  assert.deepEqual(pos.l1, { x: 0, y: 572 });
});

test('a note keeps the same small tilt', () => {
  const ids = ['a', 'b', 'c', 'longer-id-1', 'longer-id-2', 'x9'];
  const tilts = ids.map(C.noteTilt);
  assert.deepEqual(ids.map(C.noteTilt), tilts);
  assert.ok(tilts.every(t => Math.abs(t) <= 1.4));
  assert.ok(new Set(tilts).size > 1);
});

test('list order: new tasks first, then your arrangement', () => {
  const list = [
    task({ id: 'b', listRank: 1 }),
    task({ id: 'a', listRank: 0 }),
    task({ id: 'fresh', priority: 'high' }),
    task({ id: 'finished', status: 'done', completedAt: THU, listRank: 2 }),
  ];
  assert.deepEqual(C.listOrder(list).map(t => t.id), ['fresh', 'a', 'b']);
});

test('a new task goes to the top of the list and keeps everything else in place', () => {
  const list = [task({ id: 'a', priority: 'high' }), task({ id: 'b' }), task({ id: 'c', listRank: 5 })];
  const fresh = task({ id: 'new', priority: 'low' });
  list.push(fresh);
  C.rankFirst(list, fresh);
  assert.deepEqual(C.listOrder(list).map(t => t.id), ['new', 'a', 'b', 'c']);
});

test('moving a list row works around hidden rows', () => {
  const all = ['a', 'b', 'c', 'd', 'e'];
  assert.deepEqual(C.reorderIds(all, 'e', 'b', null), ['a', 'e', 'b', 'c', 'd']);
  assert.deepEqual(C.reorderIds(all, 'a', null, 'c'), ['b', 'c', 'a', 'd', 'e']); // dropped after the last row showing
  assert.deepEqual(C.reorderIds(all, 'a', null, null), ['b', 'c', 'd', 'e', 'a']);
  assert.deepEqual(C.reorderIds(all, 'a', 'a', null), ['b', 'c', 'd', 'e', 'a'].sort((x, y) => all.indexOf(x) - all.indexOf(y)));
});

test('list sort preference is checked when loading', () => {
  const load = prefs => C.parseDataFile(JSON.stringify({ app: 'Taskmaster', version: 1, owner: { id: 'x', name: 'A' }, tasks: [], prefs })).prefs.listSort;
  assert.equal(load({}), 'order');
  assert.equal(load({ listSort: 'date' }), 'date');
  assert.equal(load({ listSort: 'nonsense' }), 'order');
});

test('a forgotten timer can stop at the time you really stopped', () => {
  const now = new Date(2026, 10, 5, 18, 0);
  const t = task({ timerStartedAt: local(2026, 11, 5, 9, 0) });
  assert.equal(C.stopTimerAt(t, new Date(2026, 10, 5, 8, 0), now), false, 'before it started');
  assert.equal(C.stopTimerAt(t, new Date(2026, 10, 5, 19, 0), now), false, 'in the future');
  assert.equal(C.stopTimerAt(t, new Date('nonsense'), now), false);
  assert.equal(t.timeSessions.length, 0);
  assert.ok(t.timerStartedAt, 'still running after a refused time');
  assert.equal(C.stopTimerAt(t, new Date(2026, 10, 5, 11, 30), now), true);
  assert.equal(t.timerStartedAt, null);
  assert.equal(t.timeSessions[0].seconds, 2.5 * 3600);
  assert.equal(C.stopTimerAt(t, new Date(2026, 10, 5, 12, 0), now), false, 'not running any more');
});

test('a stop time in the current minute never counts past now', () => {
  const now = new Date(2026, 10, 5, 18, 0, 20);
  const t = task({ timerStartedAt: local(2026, 11, 5, 17, 0) });
  assert.equal(C.stopTimerAt(t, new Date(2026, 10, 5, 18, 0, 50), now), true);
  assert.equal(t.timeSessions[0].seconds, 3620);
});

test('spotting and guessing about forgotten timers', () => {
  const now = new Date(2026, 10, 5, 18, 0);
  assert.equal(C.timerLooksForgotten(task({}), now), false);
  assert.equal(C.timerLooksForgotten(task({ timerStartedAt: local(2026, 11, 5, 15, 0) }), now), false);
  assert.equal(C.timerLooksForgotten(task({ timerStartedAt: local(2026, 11, 5, 13, 0) }), now), true);
  assert.equal(C.timerLooksForgotten(task({ timerStartedAt: local(2026, 11, 4, 23, 59) }), new Date(2026, 10, 5, 0, 5)), true);
  const t = task({ timerStartedAt: local(2026, 11, 3, 9, 0) });
  assert.deepEqual(C.timerStopGuess(t, local(2026, 11, 3, 16, 40), now), new Date(2026, 10, 3, 16, 40));
  assert.deepEqual(C.timerStopGuess(t, local(2026, 11, 2, 9, 0), now), new Date(2026, 10, 3, 10, 0));
  assert.deepEqual(C.timerStopGuess(t, null, now), new Date(2026, 10, 3, 10, 0));
  assert.deepEqual(C.timerStopGuess(task({ timerStartedAt: local(2026, 11, 5, 17, 50) }), null, now), now);
  assert.equal(C.localDateTimeValue(new Date(2026, 0, 5, 9, 7)), '2026-01-05T09:07');
});

const sizes = { h: () => 200, w: () => 280 };
const spot = (x, y) => ({ position: { x, y } });

test('areas load safely, and older files simply have none', () => {
  const load = areas => C.parseDataFile(JSON.stringify({ app: 'Taskmaster', version: 1, owner: { id: 'x', name: 'A' }, tasks: [], areas })).areas;
  assert.deepEqual(load(undefined), []);
  assert.equal(load([{ id: 'a', name: 'Clinic', x: 1, y: 2, w: 500, h: 400 }, { id: 'b', x: 'bad' }, 'nonsense']).length, 1);
  assert.equal(load([{ id: 'a', x: 0, y: 0, w: 10, h: 10 }])[0].w, C.AREA_MIN_W);
  assert.equal(C.emptyData('A').areas.length, 0);
});

test('a note belongs to the area its centre sits in', () => {
  const big = C.newArea({ id: 'big', x: 0, y: 0, w: 1000, h: 1000 }), small = C.newArea({ id: 'small', x: 100, y: 100, w: 400, h: 400 });
  const list = [task({ id: 'in', ...spot(150, 150) }), task({ id: 'outer', ...spot(700, 700) }), task({ id: 'out', ...spot(2000, 0) }), task({ id: 'edge', ...spot(-200, 0) }), task({ id: 'unplaced' })];
  assert.deepEqual(C.assignAreas(list, [big, small], sizes.h, sizes.w), { in: 'small', outer: 'big', out: null, edge: null, unplaced: null });
});

test('tidying sorts inside each area and keeps areas where they are', () => {
  const a = C.newArea({ id: 'a', x: 100, y: 50, w: 928, h: 300 });
  const list = [task({ id: 'n', ...spot(120, 100) }), task({ id: 'h', priority: 'high', ...spot(500, 100) }), task({ id: 'loose', ...spot(3000, 3000) })];
  const r = C.tidyBoard(list, [a], sizes.h, sizes.w, { x: 0, y: 0, w: 1000 }, { n: 'a', h: 'a', loose: null });
  assert.equal(r.areas[0].x, 100);
  assert.equal(r.areas[0].y, 50);
  assert.deepEqual(r.positions.h, { x: 120, y: 96 }, 'high priority first, under the area heading');
  assert.equal(r.positions.n.y, 96 + 200 + 24, 'next priority on its own row');
  assert.ok(r.areas[0].h >= r.positions.n.y + 200 - 50, 'area grew to hold its notes');
  assert.ok(r.positions.loose.y >= r.areas[0].y + r.areas[0].h, 'loose notes go below the areas');
});

test('an area that grows pushes down the one below it, but not one beside it', () => {
  const top = C.newArea({ id: 'top', x: 0, y: 0, w: 600, h: 200 });
  const below = C.newArea({ id: 'below', x: 0, y: 220, w: 600, h: 200 });
  const beside = C.newArea({ id: 'beside', x: 800, y: 100, w: 400, h: 200 });
  const list = ['a', 'b', 'c', 'd'].map(id => task({ id }));
  const assign = { a: 'top', b: 'top', c: 'top', d: 'top' };
  const r = C.tidyBoard(list, [below, top, beside], sizes.h, sizes.w, { x: 0, y: 0, w: 1000 }, assign);
  const by = id => r.areas.find(x => x.id === id);
  assert.ok(by('below').y >= by('top').y + by('top').h, 'no overlap');
  assert.equal(by('beside').y, 100);
  assert.equal(r.areas[0].id, 'below', 'original order kept');
});

test('a wide note widens its area instead of spilling out', () => {
  const a = C.newArea({ id: 'a', x: 0, y: 0, w: 320, h: 200 });
  const r = C.tidyBoard([task({ id: 'w' })], [a], sizes.h, () => 560, { x: 0, y: 0, w: 1000 }, { w: 'a' });
  assert.equal(r.areas[0].w, 600);
});

test('without areas, tidying is the same as before', () => {
  const list = [task({ id: 'n' }), task({ id: 'h', priority: 'high' })];
  const view = { x: 10, y: 20, w: 900 };
  const r = C.tidyBoard(list, [], sizes.h, sizes.w, view, {});
  assert.deepEqual(r.positions, C.tidyLayout(list, sizes.h, view, C.NOTE_W, 24, sizes.w));
  assert.deepEqual(r.areas, []);
});

test('client areas: one per client, reusing existing ones whatever the capitals', () => {
  const old = C.newArea({ id: 'old', name: 'clinic', x: 0, y: 0, w: 900, h: 300 });
  const list = [task({ id: '1', clientTag: 'Clinic' }), task({ id: '2', clientTag: ' CLINIC ' }), task({ id: '3', clientTag: 'Dental' }), task({ id: '4' })];
  const r = C.clientAreas(list, [old], { x: 5, y: 5, w: 1000, ownerId: 'me' });
  assert.equal(r.created, 1);
  assert.equal(r.areas.length, 2);
  assert.equal(r.assign['1'], 'old');
  assert.equal(r.assign['2'], 'old');
  const dental = r.areas.find(a => a.name === 'Dental');
  assert.equal(r.assign['3'], dental.id);
  assert.ok(!('4' in r.assign));
  assert.ok(dental.y >= 300);
  assert.equal(dental.ownerId, 'me');
  assert.equal(C.areaForClient(r.areas, 'dental').id, dental.id);
  assert.equal(C.areaForClient(r.areas, ''), null);
});

test('new client areas are sized to their notes and flow into rows', () => {
  const list = [
    task({ id: 'a1', clientTag: 'A' }),
    task({ id: 'b1', clientTag: 'B' }), task({ id: 'b2', clientTag: 'B' }), task({ id: 'b3', clientTag: 'B' }), task({ id: 'b4', clientTag: 'B' }),
    task({ id: 'c1', clientTag: 'C' }),
  ];
  const made = C.clientAreas(list, [], { x: 0, y: 0, w: 2000, ownerId: 'me' });
  const by = n => made.areas.find(a => a.name === n);
  assert.equal(by('A').w, 624, 'room for two notes');
  assert.equal(by('B').w, 928, 'room for three notes, no more');
  assert.equal(by('B').y, by('A').y, 'same row while they fit');
  assert.equal(by('C').x, 0, 'next row when they do not');
  const placed = C.tidyBoard(list, made.areas, sizes.h, sizes.w, { x: 0, y: 0, w: 1300 }, made.assign);
  const fin = n => placed.areas.find(a => a.name === n);
  assert.ok(fin('C').y >= fin('A').y + fin('A').h, 'an area that grows pushes down the one under it');
  assert.equal(fin('A').y, fin('B').y);
});

test('an area grows to hold a note dropped at its edge', () => {
  const a = C.newArea({ x: 100, y: 100, w: 400, h: 300 });
  assert.deepEqual(C.grownArea(a, { x: 300, y: 300, w: 280, h: 200 }), { w: 500, h: 420 });
  assert.deepEqual(C.grownArea(a, { x: 110, y: 110, w: 100, h: 100 }), { w: 400, h: 300 });
});

test('new task: fields beat typed shortcuts, and both beat the template', () => {
  const tpl = { id: 't', name: 'Report', title: 'Monthly report', desc: 'From the template', priority: 'low', clientTag: 'Clinic', service: 'paid', color: 'blue', subtasks: ['Pull data', 'Write up'] };
  const parsed = C.parseQuickAdd('!high #Dental', { today: THU });
  const typed = C.quickValues(parsed, tpl, {});
  assert.equal(typed.title, 'Monthly report', 'a blank name uses the template');
  assert.equal(typed.priority, 'high');
  assert.equal(typed.clientTag, 'Dental');
  assert.equal(typed.color, 'blue');
  assert.equal(typed.desc, 'From the template');
  assert.deepEqual(typed.subtasks, ['Pull data', 'Write up']);
  const chosen = C.quickValues(parsed, tpl, { priority: 'medium', clientTag: '', color: 'pink', removedSubs: ['Pull data'], addedSubs: ['Check totals'] });
  assert.equal(chosen.priority, 'medium', 'choosing Normal beats !high');
  assert.equal(chosen.clientTag, '', 'clearing the client sticks');
  assert.equal(chosen.color, 'pink');
  assert.deepEqual(chosen.subtasks, ['Write up', 'Check totals']);
});

test('new task: nothing extra is required', () => {
  const v = C.quickValues(C.parseQuickAdd('Call Bob', { today: THU }), null, {});
  const t = C.taskFromQuick(v, { ownerId: 'me' });
  assert.equal(t.title, 'Call Bob');
  assert.equal(t.priority, 'medium');
  assert.equal(t.status, 'progress');
  assert.equal(t.color, 'yellow');
  assert.equal(t.due, null);
  assert.deepEqual(t.subtasks, []);
  assert.deepEqual(t.timeSessions, []);
  assert.equal(t.templatePrompted, false);
  assert.equal(t.ownerId, 'me');
  assert.equal(C.quickValues({}, null, {}).title, '');
});

test('new task: every optional field lands on the task', () => {
  const now = new Date(2026, 10, 5, 12, 0);
  const v = C.quickValues({ title: ' Audit ' }, null, { due: '2026-11-12', start: '2026-11-09', priority: 'low', clientTag: ' Clinic ', service: 'google', color: 'teal', desc: 'Notes here', status: 'waiting', waitingOn: ' Sam ', recurrence: 'monthly', withName: ' Ana ', star: true, startTimer: true, addedSubs: ['One'], spent: '1h 20m' });
  const t = C.taskFromQuick(v, { ownerId: 'me', now });
  assert.equal(t.title, 'Audit');
  assert.deepEqual([t.due, t.start, t.priority, t.clientTag, t.service, t.color, t.desc, t.status, t.waitingOn, t.recurrence, t.withName, t.star], ['2026-11-12', '2026-11-09', 'low', 'Clinic', 'google', 'teal', 'Notes here', 'waiting', 'Sam', 'monthly', 'Ana', true]);
  assert.equal(t.recurrenceAnchorDay, 12);
  assert.equal(t.subtasks[0].name, 'One');
  assert.equal(t.subtasks[0].done, false);
  assert.equal(t.timeSessions[0].seconds, 4800);
  assert.equal(t.timeSessions[0].endedAt, now.toISOString());
  assert.equal(t.timeSessions[0].startedAt, new Date(2026, 10, 5, 10, 40).toISOString());
  assert.equal(C.taskSeconds(t, now), 4800);
  assert.equal(v.startTimer, true);
});

test('new task: waiting details only count while waiting, and bad times are flagged', () => {
  const t = C.taskFromQuick(C.quickValues({ title: 'A' }, null, { status: 'progress', waitingOn: 'Sam' }), { ownerId: 'me' });
  assert.equal(t.waitingOn, '');
  assert.equal(C.quickValues({ title: 'A' }, null, { spent: 'soon' }).spentBad, true);
  assert.equal(C.quickValues({ title: 'A' }, null, { spent: '45' }).seconds, 2700);
  assert.equal(C.quickValues({ title: 'A' }, null, { spent: '  ' }).spentBad, false);
});

test('a task from a template remembers it came from one', () => {
  const v = C.quickValues({}, { title: 'From it', subtasks: [{ name: 'Old style' }] }, {});
  const t = C.taskFromQuick(v, { ownerId: 'me' });
  assert.equal(t.templatePrompted, true);
  assert.equal(t.subtasks[0].name, 'Old style');
});

test('theme preference is checked when loading', () => {
  const load = prefs => C.parseDataFile(JSON.stringify({ app: 'Taskmaster', version: 1, owner: { id: 'x', name: 'A' }, tasks: [], prefs })).prefs.theme;
  assert.equal(load({}), 'light');
  assert.equal(load({ theme: 'dark' }), 'dark');
  assert.equal(load({ theme: 'system' }), 'system');
  assert.equal(load({ theme: 'neon' }), 'light');
});

test('due times show on the label, and count once they pass', () => {
  const at = (h, m = 0) => new Date(2026, 10, 5, h, m);
  const t = task({ due: THU, dueTime: '14:30' });
  assert.deepEqual(C.dueLabel(t, THU, at(9)), { text: 'Due today, 14:30', kind: 'today' });
  assert.deepEqual(C.dueLabel(t, THU, at(14, 30)), { text: 'Due today, 14:30', kind: 'today' });
  assert.deepEqual(C.dueLabel(t, THU, at(14, 31)), { text: 'Late, was due 14:30', kind: 'late' });
  assert.deepEqual(C.dueLabel(t, THU), { text: 'Due today, 14:30', kind: 'today' });
  assert.deepEqual(C.dueLabel(task({ due: '2026-11-06', dueTime: '09:00' }), THU, at(12)), { text: 'Fri 6 Nov, 09:00', kind: '' });
  assert.deepEqual(C.dueLabel(task({ due: '2026-11-04', dueTime: '09:00' }), THU, at(12)), { text: '1 day late', kind: 'late' });
  assert.deepEqual(C.dueLabel(task({ due: THU }), THU, at(23)), { text: 'Due today', kind: 'today' });
  assert.deepEqual(C.dueLabel(task({ due: THU, dueTime: '09:00', status: 'done' }), THU, at(12)), { text: 'Thu 5 Nov, 09:00', kind: '' });
  assert.equal(C.isOverdue(t, THU, at(15)), true);
  assert.equal(C.isOverdue(t, THU, at(9)), false);
  assert.equal(C.isOverdue(t, THU), false);
  assert.equal(C.isOverdue(task({ due: THU }), THU, at(23)), false);
});

test('typing a time into a task name', () => {
  const parse = (s, now) => C.parseQuickAdd(s, { today: THU, now });
  const a = parse('Call Bob fri 14:30 !high');
  assert.deepEqual([a.title, a.due, a.dueTime, a.priority], ['Call Bob', '2026-11-06', '14:30', 'high']);
  assert.deepEqual([parse('Call Bob tomorrow at 3pm').title, parse('Call Bob tomorrow at 3pm').dueTime], ['Call Bob', '15:00']);
  assert.equal(parse('Call fri 3:30pm').dueTime, '15:30');
  assert.equal(parse('Call fri 12am').dueTime, '00:00');
  assert.equal(parse('Call fri 12pm').dueTime, '12:00');
  assert.equal(parse('Call fri 9 am').dueTime, '09:00');
  assert.equal(parse('Call fri 9 am').title, 'Call');
  const lone = parse('Standup 9am', new Date(2026, 10, 5, 8, 0));
  assert.deepEqual([lone.title, lone.due, lone.dueTime], ['Standup', THU, '09:00']);
  assert.equal(parse('Standup 9am', new Date(2026, 10, 5, 10, 0)).due, '2026-11-06', 'already passed, so tomorrow');
  for (const s of ['Call 1:1 with Bob', 'Update to 3.30', 'Fix 25:00 bug', 'Review 13pm', 'Sprint 7 notes']) {
    const p = parse(s);
    assert.equal(p.title, s, s);
    assert.equal(p.dueTime, null, s);
  }
  const off = C.parseQuickAdd('Call friday 14:30', { today: THU, ignore: ['time'] });
  assert.equal(off.dueTime, null);
  assert.equal(off.title, 'Call 14:30');
});

test('a template name on its own no longer trips the date search', () => {
  const tpl = { id: 't', name: 'Report' };
  const p = C.parseQuickAdd('/Report', { today: THU, templates: [tpl] });
  assert.equal(p.templateId, 't');
  assert.equal(p.title, '');
  assert.equal(C.parseQuickAdd('/Report 3pm', { today: THU, templates: [tpl] }).dueTime, '15:00');
});

test('due times on new, sorted, repeating and loaded tasks', () => {
  const v = C.quickValues(C.parseQuickAdd('Call fri 14:30', { today: THU }), null, {});
  assert.equal(C.taskFromQuick(v, { ownerId: 'me' }).dueTime, '14:30');
  assert.equal(C.quickValues(C.parseQuickAdd('Call fri 14:30', { today: THU }), null, { dueTime: '09:00' }).dueTime, '09:00');
  assert.equal(C.taskFromQuick(C.quickValues({ title: 'A' }, null, { dueTime: '09:00', due: null }), { ownerId: 'me' }).dueTime, null, 'no time without a date');
  const order = C.tidyOrder([task({ id: 'none', due: THU }), task({ id: 'late', due: THU, dueTime: '16:00' }), task({ id: 'early', due: THU, dueTime: '09:00' })]);
  assert.deepEqual(order.map(t => t.id), ['early', 'late', 'none']);
  const next = C.spawnRecurring(task({ due: THU, dueTime: '09:30', recurrence: 'weekly' }), THU);
  assert.equal(next.dueTime, '09:30');
  const load = t => C.parseDataFile(JSON.stringify({ app: 'Taskmaster', version: 1, owner: { id: 'x', name: 'A' }, tasks: [{ id: '1', title: 'a', ...t }] })).tasks[0].dueTime;
  assert.equal(load({ due: THU, dueTime: '09:30' }), '09:30');
  assert.equal(load({ due: THU, dueTime: '25:99' }), null);
  assert.equal(load({ dueTime: '09:30' }), null);
  assert.equal(load({ due: THU }), null);
});

test('tracked time in decimal hours', () => {
  assert.equal(C.formatHours(5400), '1.5');
  assert.equal(C.formatHours(3600), '1');
  assert.equal(C.formatHours(900), '0.25');
  assert.equal(C.formatHours(4800), '1.33');
  assert.equal(C.formatHours(8100), '2.25');
  assert.equal(C.formatHours(1800), '0.5');
  assert.equal(C.hoursLabel(5400), '1.5 h');
  assert.equal(C.hoursLabel(0), '');
  assert.equal(C.hoursLabel(10), '', 'too small to round to anything');
  assert.equal(C.formatTimeValue(5400, 'decimal'), '1.5');
  assert.equal(C.formatTimeValue(5400, 'hm'), '1h 30m');
  assert.equal(C.DEFAULT_PREFS.timeFormat, 'decimal');
});

const sess = (d, h, seconds) => ({ id: `${d}-${h}`, startedAt: local(2026, 11, d, h), endedAt: local(2026, 11, d, h), seconds });

test('editing tracked time: 5 minutes logged, 15 really spent', () => {
  const now = new Date(2026, 10, 5, 12, 0);
  const t = task({ timeSessions: [sess(4, 9, 600), sess(5, 9, 300)] });
  C.setTrackedTime(t, 1500, { now });
  assert.equal(C.taskSeconds(t, now), 1500);
  assert.equal(t.timeSessions.length, 2);
  assert.equal(t.timeSessions.find(s => s.id === '5-9').seconds, 900, 'the newest session takes the difference');
  assert.equal(t.timeSessions.find(s => s.id === '5-9').endedAt, new Date(2026, 10, 5, 9, 15).toISOString());
});

test('editing tracked time down trims newest first, and can clear it', () => {
  const now = new Date(2026, 10, 5, 12, 0);
  const t = task({ timeSessions: [sess(4, 9, 600), sess(5, 9, 300)] });
  C.setTrackedTime(t, 480, { now });
  assert.deepEqual(t.timeSessions.map(s => [s.id, s.seconds]), [['4-9', 480]]);
  C.setTrackedTime(t, 0, { now });
  assert.deepEqual(t.timeSessions, []);
});

test('editing tracked time with nothing tracked yet adds a session', () => {
  const now = new Date(2026, 10, 5, 12, 0);
  const t = task({});
  C.setTrackedTime(t, 900, { now });
  assert.equal(t.timeSessions[0].seconds, 900);
  assert.equal(t.timeSessions[0].endedAt, now.toISOString());
  assert.equal(C.localDate(t.timeSessions[0].startedAt), THU);
});

test('editing one day leaves other days alone', () => {
  const now = new Date(2026, 10, 5, 12, 0);
  const t = task({ timeSessions: [sess(3, 9, 600), sess(4, 9, 300), sess(4, 14, 300)] });
  C.setTrackedTime(t, 900, { date: '2026-11-04', now });
  assert.equal(t.timeSessions.find(s => s.id === '3-9').seconds, 600);
  assert.equal(t.timeSessions.find(s => s.id === '4-14').seconds, 600);
  C.setTrackedTime(t, 1800, { date: '2026-11-02', now });
  const added = t.timeSessions.find(s => C.localDate(s.startedAt) === '2026-11-02');
  assert.equal(added.seconds, 1800, 'a day with nothing tracked gets its own session');
});

test('editing tracked time stops a running timer, and a raised total needs logging again', () => {
  const now = new Date(2026, 10, 5, 12, 0);
  const t = task({ timerStartedAt: local(2026, 11, 5, 11, 50), loggedDays: { [THU]: 600 } });
  C.setTrackedTime(t, 900, { now });
  assert.equal(t.timerStartedAt, null);
  assert.equal(C.taskSeconds(t, now), 900);
  const row = C.timeRows([t], C.weekStart(THU), { now })[0].rows[0];
  assert.equal(row.seconds, 900);
  assert.equal(row.logged, false);
});

test('reading an edited time', () => {
  assert.equal(C.parseTimeEdit('15m'), 900);
  assert.equal(C.parseTimeEdit('1h 30m'), 5400);
  assert.equal(C.parseTimeEdit('1.5h'), 5400);
  assert.equal(C.parseTimeEdit('15'), 900);
  assert.equal(C.parseTimeEdit('0'), 0);
  assert.equal(C.parseTimeEdit('0m'), 0);
  assert.equal(C.parseTimeEdit('soon'), null);
  assert.equal(C.parseTimeEdit(''), null);
});

const fileWith = o => C.parseDataFile(JSON.stringify({ app: 'Taskmaster', version: 1, owner: { id: 'x', name: 'A' }, tasks: [], ...o }));

test('older files start with every client already in use', () => {
  const d = fileWith({ tasks: [{ id: '1', title: 'a', clientTag: 'Clinic' }, { id: '2', title: 'b', clientTag: ' clinic ' }, { id: '3', title: 'c', status: 'done', clientTag: 'Dental' }], notes: [{ id: 'n', clientTag: 'Vision' }], templates: [{ id: 't', name: 'T', clientTag: 'Skin' }] });
  assert.deepEqual(d.clients.map(c => c.name).sort(), ['Clinic', 'Dental', 'Skin', 'Vision']);
  assert.equal(d.clients[0].ownerId, 'x');
  assert.deepEqual(C.emptyData('A').clients, []);
});

test('a client you removed stays removed after reloading', () => {
  const d = fileWith({ tasks: [{ id: '1', title: 'a', clientTag: 'Clinic' }], clients: [] });
  assert.deepEqual(d.clients, []);
  assert.equal(d.tasks[0].clientTag, 'Clinic');
});

test('saved clients load safely, without duplicates', () => {
  const d = fileWith({ clients: [{ id: 'a', name: 'Clinic' }, { id: 'b', name: ' clinic ' }, { id: 'c', name: '' }, 'junk', null, { name: 'Dental' }] });
  assert.deepEqual(d.clients.map(c => c.name), ['Clinic', 'Dental']);
  assert.ok(d.clients[1].id);
});

test('typing a client saves it once, keeping the first spelling', () => {
  const list = [];
  assert.equal(C.addClient(list, ' Clinic ', 'me'), 'Clinic');
  assert.equal(C.addClient(list, 'CLINIC', 'me'), 'Clinic');
  assert.equal(C.addClient(list, '', 'me'), '');
  assert.equal(C.addClient(list, '   ', 'me'), '');
  assert.equal(list.length, 1);
  assert.equal(list[0].ownerId, 'me');
  assert.equal(C.findClient(list, 'clinic').name, 'Clinic');
  assert.equal(C.findClient(list, 'other'), null);
  assert.equal(C.findClient(list, ''), null);
});

test('client stats count open work, finished work, notes and time', () => {
  const tasks = [task({ clientTag: 'Clinic', timeSessions: [{ seconds: 3600 }] }), task({ clientTag: ' clinic', status: 'done', timeSessions: [{ seconds: 1800 }] }), task({ clientTag: 'Other', timeSessions: [{ seconds: 60 }] })];
  assert.deepEqual(C.clientStats('Clinic', tasks, [{ clientTag: 'CLINIC' }, { clientTag: '' }]), { open: 1, done: 1, notes: 1, seconds: 5400 });
});

const clientData = () => ({
  clients: [{ id: 'a', name: 'Clinic' }, { id: 'b', name: 'Dental' }],
  tasks: [task({ id: 't1', clientTag: 'Clinic' }), task({ id: 't2', clientTag: 'Dental' })],
  notes: [{ id: 'n1', clientTag: 'clinic' }],
  templates: [{ id: 'p1', clientTag: 'Clinic' }],
  areas: [C.newArea({ id: 'r1', name: 'Clinic' }), C.newArea({ id: 'r2', name: 'Urgent' })],
});

test('renaming a client updates everything using it', () => {
  const d = clientData();
  assert.deepEqual(C.renameClient(d, 'a', 'Northside Clinic'), { merged: false });
  assert.equal(d.clients[0].name, 'Northside Clinic');
  assert.equal(d.tasks[0].clientTag, 'Northside Clinic');
  assert.equal(d.tasks[1].clientTag, 'Dental');
  assert.equal(d.notes[0].clientTag, 'Northside Clinic');
  assert.equal(d.templates[0].clientTag, 'Northside Clinic');
  assert.equal(d.areas[0].name, 'Northside Clinic');
  assert.equal(d.areas[1].name, 'Urgent');
});

test('renaming a client to another one combines them', () => {
  const d = clientData();
  assert.deepEqual(C.renameClient(d, 'a', 'dental'), { merged: true });
  assert.deepEqual(d.clients.map(c => c.name), ['Dental']);
  assert.equal(d.tasks[0].clientTag, 'Dental');
  assert.equal(d.notes[0].clientTag, 'Dental');
});

test('changing only the capitals of a client is a rename', () => {
  const d = clientData();
  assert.deepEqual(C.renameClient(d, 'a', 'CLINIC'), { merged: false });
  assert.equal(d.clients.length, 2);
  assert.equal(d.tasks[0].clientTag, 'CLINIC');
});

test('removing a client keeps old work unless asked to clear it', () => {
  const kept = clientData();
  C.removeClient(kept, 'a');
  assert.deepEqual(kept.clients.map(c => c.id), ['b']);
  assert.equal(kept.tasks[0].clientTag, 'Clinic');
  const cleared = clientData();
  C.removeClient(cleared, 'a', { clear: true });
  assert.equal(cleared.tasks[0].clientTag, '');
  assert.equal(cleared.notes[0].clientTag, '');
  assert.equal(cleared.templates[0].clientTag, '');
  assert.equal(cleared.tasks[1].clientTag, 'Dental');
  assert.equal(cleared.areas[0].name, 'Clinic', 'an area keeps its label');
});

test('escaping for display', () => {
  assert.equal(C.esc(`<a href="x">'&`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
});
