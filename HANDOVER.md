# Taskmaster handover

Notes for continuing development on another computer or in a new Claude Code session. `README.md` covers using the app.

## What it is

A personal sticky-note task board for OMD (Online Marketing For Doctors), replacing Taskmaster 0.4. It's plain HTML, CSS and JavaScript with no runtime libraries. `build.cjs` combines `src/` and the fonts into one offline file, `Taskmaster.html`.

Commit the rebuilt `Taskmaster.html` with every source change, because that's the file people open.

## Working on it

Node 22 is needed only for building and testing.

```bash
node build.cjs
```

```bash
node --test tests/core.test.cjs
```

- `src/core.js`: pure logic, covered by the tests. Put new logic here first, with a test.
- `src/storage.js`: the only code that reads or writes saved data. A hosted version would replace it.
- `src/ui-*.js`: the screens, using `data-act` buttons that call `app.actions`. Changes go through `app.change` so they can be undone.
- Script order is set in `build.cjs`. A new `ui-*.js` file must be added there.
- Check changes in a real browser as well as the tests. Pointer drags, modals and dark mode can't be covered by the tests.

## Rules the owner has set

- Keep the app decluttered and focused on to-do lists and sticky notes.
- No time estimates on tasks, and no Google Meet or other integrations for now.
- Templates are made by the user, not supplied.
- Priority shows High and Low only. Normal is the default and has no label, and is stored as `medium`.
- Keep the existing sticky note colours.
- Never change `clients.json` or Taskmaster 0.4. Importing only reads them.
- Don't commit `taskmaster.json` or `backups/`. They hold real client data, and `.gitignore` excludes them.

## OMD style

Font: Poppins (included). Greens: `#33C88A`, `#3BE29E`, `#1A8F61`. Mint: `#E2F5EF`. Charcoal: `#2A2A2A`. Light grey cards: `#F2F4F5`. Red: `#D93A33`. Colours are CSS variables at the top of `src/styles.css`, with dark mode values further down under `:root[data-theme=dark]`. Sticky notes keep light paper colours in both themes.

## Ideas set aside for later

- Time tab: a "copy everything not yet logged" button that also marks it logged, and grouping copied time by client.
- Hosted version with a separate login and list for each person, then possibly direct Basecamp sync. Each person's data is already tagged with an owner.

## Things not yet confirmed in real use

- The folder picker when choosing where to save.
- Pasting copied hours into Basecamp. The app reports a successful copy, but the clipboard contents weren't read back.
- Shift-drag box select with a real keyboard and mouse. It was only tested with simulated input.
- Clicking an empty Client box to open its list straight away.
- How sounds and animations feel.

## Also worth knowing

- One imported task has a 198h 5m session, probably a forgotten timer. Its owner can fix it with the Edit button.
- The video guide script is a Claude doc in the owner's account: https://claude.ai/artifact/CNMUKHwvXTAEANb9AmwRL3. Update it when features change.
- Design documents are in `docs/`.
