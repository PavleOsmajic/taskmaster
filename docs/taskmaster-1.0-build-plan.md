# Taskmaster 1.0 Implementation Plan

**Goal:** Build the approved personal sticky board app in `Desktop\Taskmaster_V1.0\`.

**Architecture:** Plain JavaScript and CSS in `src/`, combined by `build.cjs` into one `Taskmaster.html` with fonts built in. `core.js` holds logic with no screen code, so Node can test it. `storage.js` is the only code that reads or writes saved data, so a server version can replace it later.

**Tech stack:** HTML, CSS, JavaScript. Node 22 for the build and tests only. No runtime libraries.

**Spec:** `taskmaster-1.0-design.md`. Visual reference: `taskmaster-1.0-mockup.html`.

## Global constraints

- Never change `Taskmaster_V0.4\` or any `clients.json`.
- Runs from a double-clicked file, offline.
- Poppins and the slide colours from the spec. Note colours are chosen by the person, and priority is only a label.

## Review focus

1. A damaged `taskmaster.json` must stop with an explanation and must not be overwritten.
2. A failed save must show a clear warning and keep unsaved work on screen. A file changed elsewhere must not be silently overwritten.
3. Importing the same V0.4 file twice must not create duplicates.
4. Sessions past midnight count on the day they started. A timer keeps counting after the app closes and reopens.
5. Titles containing `<`, `&`, quotes or very long words must display as text and must not break the layout.

## Tasks

1. **Core logic, tests first** (`src/core.js`, `tests/core.test.cjs`): dates, quick-add parsing, durations, time rows and copy text, recurrence, calendar lanes, free-spot and tidy layout, V0.4 migration, data validation.
2. **Storage** (`src/storage.js`): data folder and browser storage, five backups, conflict detection, damaged-file protection. Check against a real browser directory handle.
3. **Shell and setup** (`src/ui-app.js`, `src/ui-setup.js`, `src/styles.css`, `build.cjs`): first run, import preview, top bar, person menu, undo, shortcuts.
4. **Board** (`src/ui-board.js`): notes, drag, zoom, pan, fit, tidy, filters, today focus, tray, detail panel, colours.
5. **Quick add and templates** (in `ui-board.js`): chips, suggestions, template prompt and management.
6. **Calendar** (`src/ui-calendar.js`): off, week, month, drag to reschedule, bars, jump to note.
7. **Time and Notes** (`src/ui-time.js`, `src/ui-notes.js`): week view, copy, logged ticks, format and rounding, notes editor and search.
8. **Verification:** Node tests, browser checks on a copy of real data including reload persistence, opening from `file://`, README.

Each task finishes with its tests or browser checks passing before the next begins. The folder isn't a git repository, so there are no commit steps.
