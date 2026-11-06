# Taskmaster 1.0: design

Date: 5 November 2026. Replaces Taskmaster V0.4 (`Desktop\Taskmaster_V0.4\ClientTracker.html`).

Labels used below: **[Pavle]** was decided by Pavle. **[Call]** is the designer's call and can be overruled.

## 1. Why

V0.4 grew into a client tracker, but Pavle mostly adds tasks, tracks them as sticky notes, tags them by priority and rearranges them on screen. The saved data supports this: the newest file (28 Oct) has 61 tasks and 9 clients, no weekly notes, and no recurring, reminder, waiting-on or today-focus tasks.

1.0 is a focused personal task board in the OMD style. Clutter goes, and the sticky notes, time tracking, calendar and notes get better.

**Success looks like:**
- Opening the app shows the board and nothing competes with it.
- Priority, due date, subtask progress and time spent can be read on a note at a glance.
- Copying a week's time into Basecamp takes about a minute.
- Existing tasks, positions and time history arrive intact.
- A colleague can copy the folder, open the file and have their own saved list.

**It fails, even if it works technically, if:**
- It feels cluttered again.
- Old data is lost or V0.4's data files are changed.
- Tasks or notes fail to save without a clear warning.

## 2. Scope

**In [Pavle]:** a redesigned sticky board with more space, Off/Week/Month calendar, improved time tracking, Notes tab, per-person lists, OMD slide style, classic sticky colours, and version 1.0.

**Added from other apps [Pavle]:**
- zoom, pan and a larger board
- quick add by typing
- today focus
- dragging tasks on the calendar
- start dates shown as bars
- a copy-for-Basecamp button
- user-created templates
- keyboard shortcuts and undo

**Not included [Pavle]:** time estimates, turning a note line into a task, and any Google Meet integration.

**Removed from the interface [Pavle accepted the proposal]:** client pages, stats, content calendars, review pages, and the old Weekly Notes page.

**Also not in 1.0 [Call]:**
- Kanban and list views, because the board is the product.
- Dark theme, because the slide style is light.
- Reminders and group approval tasks, because the saved data doesn't use them.
- Points, streaks, habit tracking, AI features, Gantt charts and integrations.

**Hosting [Pavle: later]:** no server work in 1.0, but the data must be ready for it (section 10).

## 3. Visual style [Pavle: match the slides]

The reference is the two OMD PDFs: October Performance Review and Meta Ads Proposal.

- **Font:** Poppins, built into the file so it works offline.
- **Colours:** green `#33C88A`, bright green `#3BE29E`, dark green `#1A8F61`, mint `#E2F5EF`, charcoal `#2A2A2A`, text `#333333`, muted text `#6B6F76`, grey card `#F2F4F5`, red `#E95B54`.
- **Details:** white pages, soft rounded cards, small spaced-out capital labels, a green bar along the bottom edge, and the OMD cross beside "Task**master** 1.0".
- **Reference mockup:** `taskmaster-1.0-mockup.html`, next to this document.

## 4. Layout

- **Top bar:** logo, Board / Notes / Time tabs, running timer, person menu, + New task.
- **Thin mint bar on Board only:** calendar switch, Today focus, search, counts of tasks due and overdue.
- **Board:** everything else.

The person menu holds name, data location, export/import, backups, templates, sound and keyboard shortcuts.

## 5. Board and sticky notes

**Note contents, top to bottom:**
1. Priority label and due date. Overdue is a red pill and due today is a yellow pill.
2. Title.
3. Client tag and service, when set.
4. Up to 3 subtasks that can be ticked on the note, then "+N more".
5. Progress bar.
6. Large timer button, time spent, and "2 of 5".

**Note colours [Pavle]:** classic sticky style with a folded corner, and each person chooses each note's paper colour. Priority never changes the paper colour.
- The palette is V0.4's: yellow, pink, peach, green, blue, lavender and white. Colours and their meaning are personal, and the app doesn't name them.
- New notes start yellow [Call]. Imported notes keep their colour, and those with no colour stay white.
- Colour can be changed from the detail panel or by right-clicking a note.
- The mint bar has colour dots that filter the board by colour, dimming the rest [Call].

**Priority label [Call]:** because colour no longer shows priority, the label has to stand out. High is a solid red label, Medium is a plain outlined label, and Low is a muted one.

**Running timer:** the note gets a green outline, and the top bar shows the task name and time.

**Note actions:**
- Click a note to open a detail panel: title, description, priority, dates, client tag, subtasks, recurrence, time sessions.
- Drag a note anywhere to move it.
- Dragging a note to the tray marks it as done.

**Done tray [Call]:** finished notes show a DONE stamp for the rest of the day, then move to a Done tray at the board's edge, from which they can be restored. V0.4 had 50 of 61 tasks complete, and leaving those on the board would bury the open ones.

**Board space:**
- Zoom from 50% to 150% with Ctrl+scroll or buttons. Pan by dragging empty space or holding the spacebar.
- The board grows as needed. Existing positions, up to about 1834 × 587 in saved data, carry over unchanged.
- "Fit all" zooms to show every note.
- "Tidy up" lines notes up by priority then due date, and can be undone [Call].
- Zoom and position are remembered per person.

**Today focus:** star any note. The Today switch dims the rest, and notes due today or overdue are included automatically.

**Search:** dims notes that don't match, without moving anything.

## 6. Adding tasks

- `N` or + New task opens a one-line quick add. Enter creates a note.
- **Typed shortcuts:**
  - **Dates:** `today`, `tomorrow`, weekday names, `12 nov`. The next matching date is used.
  - **Priority:** `!high`, `!med`, `!low`.
  - **Client:** `#clinic` for a client tag, which autocompletes from existing tags.
  - **Templates:** `/` plus a template name.
- Recognised words appear as chips before saving, and clicking a chip removes it. Anything unrecognised stays in the title.
- New notes appear in the visible part of the board, in a free spot.
- Default priority is Medium.

**Templates [Pavle: user-created]:** after creating a note, a small prompt asks whether to save it as a template. It holds title, description, subtasks, priority and client tag, without dates or time.
- [Call] The prompt shows only for notes with at least one subtask, and "Don't ask again" is available.
- Templates are listed in the quick add and can be renamed or deleted from the person menu.

## 7. Calendar [Pavle: three settings]

The switch has three settings, and the last choice is remembered:
- **Off:** board only.
- **Week:** a strip along the bottom with the current week, plus arrows to move between weeks.
- **Month:** a panel covering the right half, with the board still usable on the left.

**Behaviour:**
- Tasks use their note colour.
- Dragging a task to another day changes its due date, and can be undone.
- Clicking a task pans the board to its note and highlights it.
- Tasks with a start date and a due date show as a bar across those days. Tasks with only a due date show as one chip.
- Finished tasks stay visible but are struck through.
- Tasks with no date don't appear.

## 8. Time tracking and Basecamp

- One timer runs at a time, and starting another pauses the first [Call]. A running timer survives closing the app, because the start time is saved.
- Timer controls appear on the note, the detail panel and the top bar.
- Sessions can be added, edited or deleted in the detail panel, for when a timer was forgotten.
- A timer running for over 4 hours shows a gentle "still working?" prompt [Call].

**Time tab:**
- Choose a week, then see days with a row per task: client tag, task, time.
- Day and week totals are shown. A session counts on the day it started.
- **Copy** buttons per row, day and week copy plain text, for example `Landing page copy (Clinic A): 1h 20m`.
- Each row has a **Logged in Basecamp** tick so nothing is entered twice [Call].
- A format setting offers `1h 20m` or `1.33`, and rounding to none, 5 or 15 minutes [Call].

There is no connection to Basecamp. Copying is manual [Pavle: current workflow, nothing further requested].

## 9. Notes tab

- Two columns: a searchable list on the left, an editor on the right.
- Each note has a title, date (defaults to today), plain text body and optional client tag.
- Notes save automatically, with undo for deletions.
- No links to tasks or meeting tools [Pavle].
- Any old weekly notes import as dated notes. The sampled files have none.

## 10. People and storage

**Now [Pavle]:** anyone copies the folder to their computer and opens the file. It asks for their name, then where to save. Each computer holds that person's own list.

**Storage [Call], keeping V0.4's two options:**
- **Data folder (recommended, Chrome and Edge):** saves `taskmaster.json`, with the previous five versions in `backups\`.
- **Browser storage (fallback, other browsers):** saved in the browser, with a clear message that clearing browser data removes it and a prompt to export regularly.
- **Always:** a visible save indicator and a clear warning on failure. Also export and import of a JSON file, and a warning when the app is open in two tabs.

**Later hosting:**
- Every task, note and template has an `ownerId`, and data access goes through one small storage module, so a server version can replace it without touching the screens.
- Adapting the existing `server\` folder (sign-in, per-person views) is a separate later project.
- The hosted version won't need V0.4's service and client permissions, because lists are personal.

## 11. Bringing over V0.4 data

- On first run, or later from the person menu, the app offers **Import from Taskmaster 0.4** and reads a chosen `clients.json` or backup file.
- **It only reads. It never changes or deletes `clients.json`.** V0.4 and its data stay untouched.
- A preview shows counts of tasks, time sessions and notes before anything is saved.
- Saved data exists in two places, so the person chooses. The newest found is `Downloads\claude-tool-data\clients.json`.

**How data maps:**

| V0.4 | 1.0 |
|---|---|
| name, desc, due, subtasks, created, completedAt | same |
| priority high / normal / low | High / Medium / Low |
| state progress / waiting / approved | In progress / Waiting / Done |
| notePosition | position, unchanged |
| timeSessions, timerStartedAt | same |
| clientId | client tag using the client's name |
| service | service label; old values stay readable |
| focusToday | today star |
| recurrence weekly / monthly | same, editable in the detail panel |
| color | same colour; none stays white |
| archived or completed | Done tray |
| Assigned to someone else | task kept, with a "With [name]" tag [Call] |
| Content calendar task | ordinary task, with the link added to its description |
| Group task, reminders, other fields | stored unused on the task, so nothing is lost |
| weeklyNotes | dated notes |

Client records themselves are not imported beyond their names as tags.

## 12. Keyboard and undo

- **Shortcuts [Call]:** `N` new task, `/` search, `T` start or pause the timer on the selected note, `F` today focus, `1` `2` `3` calendar off/week/month, `0` fit all, `?` shortcut list.
- **Undo:** Ctrl+Z, plus an Undo button on a brief message after moving, deleting, completing, rescheduling or tidying. Deleted tasks are recoverable until the app closes [Call].

## 13. Constraints and delivery

- Delivered as a new folder, `Desktop\Taskmaster_V1.0\`, containing `Taskmaster.html` and a short README. V0.4 isn't touched.
- Runs by opening the file, with no install, no internet and no outside libraries.
- Works in current Chrome and Edge fully, and in other browsers with browser storage.
- Designed for desktop screens. Phones aren't a target for 1.0 [Call].

## 14. Left to the builder

- Whether to reuse V0.4 code. Its size and removed features suggest a fresh file that borrows the data handling and backup logic.
- Internal file structure and data format details, within the rules above.
- Exact animation, spacing and panel details, within the style in section 3.
- Tests: at minimum automated checks for importing, quick-add parsing and time totals, plus browser checks of the board, calendar, saving and reloading.
