# Taskmaster 1.0

A personal sticky-note task board in the OMD style. Everything runs from one file, with no install and no internet needed.

## Start using it

1. Copy this folder to your computer. `Taskmaster.html` is the only file you need to run the app.
2. Open `Taskmaster.html` in Chrome or Edge.
3. Enter your name, then choose where to save:
   - **A folder (recommended):** make an empty folder, such as `Taskmaster data`, and keep it. Taskmaster saves `taskmaster.json` there, with up to five automatic backups in `backups\`.
   - **This browser:** works in any browser, but clearing browser data deletes your tasks, so export backup files regularly.
4. To bring over Taskmaster 0.4 tasks, choose your `clients.json` file when asked. You can also do this later from the person menu. Importing only reads that file and never changes it.

Each computer keeps its own person's list. When reopening a data folder, your browser may ask you to reconnect it. That's a normal browser safety step.

## Adding a task

Press `N`. Only the name is needed, so you can type it and press Enter. Everything else in the box is optional: template, client, service, priority, due and start dates, status, repeats, who it's with, colour, Today, subtasks, notes, time already spent, and starting the timer straight away.

Tick **Save as template** at the bottom to keep the task's name, priority, client, service, colour, notes and subtasks as a template. Dates and time aren't saved in it.

You can also type details into the name, for example: `Monthly report fri !high #clinic`

- **Dates:** today, tomorrow, fri, friday, 12 nov
- **Times:** 14:30, 3pm, at 9am. A time with no date means its next occurrence.
- **Priority:** !high, !low (tasks are Normal unless you say otherwise)
- **Client:** #name
- **Template:** /name

Press `?` in the app to see all keyboard shortcuts.

## Views

Choose **Sticky notes**, **List** or **Columns** at the top of the Tasks tab, or press `V`. **Make default** sets which one Taskmaster opens in. All three show the same tasks.

In **List**, **My order** lets you drag rows into any order (or use Alt + up or down on a selected row). **By date** groups tasks by when they're due, and your order is kept for when you switch back.

**Tidy up** sorts sticky notes by priority, then due date, then colour, then creation time, with each priority on its own row. You can undo it.

## Changing several tasks at once

Shift-click or Ctrl-click tasks in any view to select them, press `Ctrl + A` to select everything showing, or hold Shift and drag across the empty board to box-select notes. A bar appears for changing priority, colour, due date, client or Today together, marking them done, or deleting them. Dragging a selected note moves the whole selection, and one undo reverses each change. `Esc` clears the selection.

## Areas

Areas are labelled parts of the sticky board, such as one for each client.

- **+ Area** adds an empty one. Name it, drag its heading to move it with its notes, and drag its corner to resize it.
- **Client areas** makes one area for each client on the board and moves their notes in. You can undo it.
- A note belongs to the area its centre sits in, and an area grows to fit a note dropped at its edge.
- A new task with a client (`#clinic`) lands in the area with that name.
- **Tidy up** sorts inside each area and puts other notes underneath. Areas stay where they are, unless one grows into the one below it.
- Deleting an area keeps its notes on the board.

## Clients

A client you type on a task or note is saved, so next time you can pick it from the list. The **Clients** tab shows each client with their open and finished tasks, notes and tracked time.

- **Add:** type a name and click **Add client**. Old data files fill the list from the clients already in use.
- **Rename:** type over the name. Every task, note, template and area using it updates. Renaming to a name already on the list combines the two.
- **Remove:** take a client off the list and either keep the name on old work or clear it. You can undo either.
- **Show tasks** opens the board filtered to that client.

## Due times

Add a time beside the due date in the New task box or a task's details, or type one into the name. It shows on the note, sorts tasks within a day, and appears on the calendar. Once it passes, the task shows as late. Taskmaster doesn't send alerts.

For the last two days before a due date, a small bell counts down: **Due in 2 days**, then **Due tomorrow**. On the day itself, a task with a due time shows the hours and minutes left, such as **Due in 2h 15m**, and updates every minute.

## Decimal hours for Basecamp

Tracked time also shows in decimal hours, so 1h 30m reads 1.5 h. In the Time tab and a task's details, click the green hours button to copy just the number, ready to paste into Basecamp. **Copy as** sets whether the Copy buttons use 1.33 or 1h 20m.

## Correcting tracked time

Forgot to start or stop a timer? Click **Edit** beside the time in a task's details, or on a row in the Time tab, and type what you really spent, such as `15m` or `1h 30m`. A plain number means minutes, and the box shows the result before you save. Details changes the task's total, and a Time tab row changes that day only. You can undo it, and a raised total shows as not yet logged.

## Forgotten timers

If a timer has run for over four hours, or since an earlier day, Taskmaster asks about it. Choose **I stopped earlier**, pick when you really stopped, and only that time is counted. The same button is in the task's details while its timer runs. To fix a session you've already stopped, edit it in the task's details.

## Dark mode

Click the moon or sun in the top bar, or press `D`. The person menu's **Appearance** option also offers **Match my computer**. Sticky notes keep their colours in dark mode.

## Effects

Finished tasks celebrate and fly into the Done tray. Sounds and effects can each be turned off in the person menu. Effects also stay off if your computer is set to reduce motion.

## Resizing notes

Drag a note's bottom-right corner. Its text grows with it, and bigger notes show more subtasks. Double-click the corner to return to the normal size, or press Shift + arrow keys on a selected note.

## Backups

- Use the person menu to export a backup file, view automatic backups, or restore from one.
- Automatic backups are saved at least five minutes apart.
- If a data file is ever damaged, Taskmaster stops without overwriting it and lets you choose a backup.

## For developers

The app is built from `src/` into `Taskmaster.html`. Node 22 is needed only for building and testing.

```bash
node build.cjs
```

```bash
node --test tests/core.test.cjs
```

- `src/core.js`: logic with no screen code, covered by the tests.
- `src/storage.js`: the only code that reads or writes saved data. A hosted version would replace this file with one that talks to a server. Every task, note and template already records its owner.
- `src/ui-*.js`: the screens.

Poppins is included under the SIL Open Font License (`src/fonts/OFL.txt`).
