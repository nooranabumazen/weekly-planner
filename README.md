# Weekly Planner

**A personal productivity app that keeps your week organized.**

Plan your tasks, schedule them by time, track habits, log your mood, write journal entries, manage projects, and take notes, all in one place. Built as a Progressive Web App that works on any device.

![Main planner view](screenshots/planner-view.png)

---

## Try It Now

**[Open Weekly Planner](https://weekly-planner-dudo.vercel.app/)** -- no account needed, works instantly in your browser.

Your data saves to your browser's local storage. No sign-up, no server, no tracking. Install it as a desktop or mobile app from your browser for the full experience.

> **Note:** In local mode, your data lives in your browser only. Clearing browser data will erase it. If you want cross-device sync, see [Setting Up Sync](#setting-up-cross-device-sync) below.

---

## At a Glance

| Feature | What it does |
|---|---|
| **Weekly Tasks** | Drag-and-drop tasks across days. Incomplete tasks carry forward automatically. Can set tasks that repeat weekly or monthly. |
| **Projects** | Long-running projects with subtask lists, progress tracking, and linked day tasks. |
| **Task Subtasks** | Any task can have a checklist of subtasks with progress (e.g., 3/5). Auto-completes the main task when all subtasks are done. |
| **Week Navigation** | Browse past and future weeks. Past weeks are view-only with completed tasks expanded. Future weeks show recurring task previews. |
| **Two Layouts** | Vertical list or horizontal columns with a time grid. Toggle from the sidebar. |
| **Time Scheduling** | Schedule tasks at specific times. Drag to time slots in horizontal view, or right-click to set a custom time anywhere. |
| **Smart Categories** | Auto-detects task type from keywords and color-codes it. Fully customizable. |
| **Auto Time Detection** | Type "1pm meeting" or "lunch 2:30-3:30" and the app schedules it automatically. |
| **Habits** | Daily checkbox grid (Mon-Sun) and weekly checklist with completion notes. |
| **Mood & Notes** | Track how you felt each day with emoji moods and short notes. Syncs with week navigation. |
| **Journal** | Daily entries with a mini calendar. Pencil icons on each day header link directly to that day's entry. |
| **Notebooks** | Rich text editor with dynamic tables, images, highlights, and color. |
| **People** | Contact cards with birthdays that auto-generate upcoming reminders. |
| **Dark Mode** | Full dark theme across every screen. |
| **Mobile** | Responsive layout with bottom nav, large touch targets, and long-press menus. |
| **Installable PWA** | Add to home screen or taskbar for a native app feel. |

---

## Features

### Task Management

Organize your week with drag-and-drop. Add tasks to any day, reorder them, and check them off. Done tasks fade and collapse below a "X done" toggle. Anything unfinished at the end of the week carries forward to Monday automatically.

**Later list** holds tasks you haven't scheduled yet. They stay uncategorized until you drag them into a day, at which point the category is auto-detected.

**Upcoming sidebar** lets you schedule tasks for future weeks. They auto-promote to the correct day when that week arrives. Each task supports text, date, and an optional time.

### Projects

A dedicated section for longer-term work that spans multiple weeks. Each project has a title and a list of subtasks with checkboxes.

- Create projects in the collapsible Projects section (between Later and Quick Notes)
- Add subtasks directly inside the project, or right-click a day task and assign it to an existing project
- Drag subtasks from a project into any day to create a linked copy. Checking off the linked task checks it off in the project too (and vice versa).
- Progress badge (e.g., "3/7") shows on the project header
- When all subtasks are done, click "Complete" to archive the entire project with its subtask history
- Completed projects appear in a separate section in the Archive tab

### Task Subtasks

Any regular task can also have its own subtasks, independent of the Projects section. Right-click a task and pick "Add subtasks" to add a checklist.

- Subtasks are visible by default underneath the task, with a collapsible progress badge (e.g., "2/5") inline with the task text
- Click the badge to collapse or expand the subtask list
- Double-click the task to enter edit mode, where you can add new subtasks and delete existing ones
- Checking off all subtasks automatically checks off the main task

### Week Navigation

Browse forward and backward through weeks using the arrows in the header. The date range updates as you navigate. Click "this week" to jump back to the current week.

- **Past weeks** are view-only with done tasks auto-expanded so you can see what was completed
- **Future weeks** show any tasks you've added ahead of time, plus previews of recurring tasks that would fire that week
- **Upcoming tasks** whose dates fall within a future week appear merged into the day view with a calendar icon
- **Habits and mood** sync with the week you're viewing: past weeks show that week's habit progress and mood entries
- **Carry-forward** merges incomplete tasks into the next week without overwriting tasks you may have already added there

### Recurring Tasks

Right-click any task and pick "Repeat" to make it repeat weekly, biweekly, or on a custom schedule. The task auto-creates on the right day going forward.

- **Skip a week**: Right-click a recurring task and pick "Skip this week" to remove it from the current week without breaking the recurring rule. It comes back next week.
- Recurring tasks show a preview in future weeks when you navigate forward

### Time Scheduling

Tasks can have specific times attached, displayed as a small badge before the task text. Times sync across all views.

**Three ways to set a time:**

1. **Drag to time slot** (horizontal view): Drop a task on the time grid. Snaps to 15-minute slots.
2. **Right-click "Set time"** (any view): Opens a small time picker.
3. **Type it in the task text**: Auto-detected when you create a task.

### Auto Time Detection

When you add a task, the text is parsed for time patterns. If found, the time is set automatically and the time text is cleaned out of the task name.

| You type... | Becomes |
|---|---|
| "1pm meeting" | "meeting" scheduled at 1:00 PM |
| "lunch 2:30-3:30" | "lunch" scheduled 2:30-3:30 PM |
| "13:30 call" | "call" scheduled at 1:30 PM |
| "review chapter 2" | no time detected (bare numbers ignored) |

### Smart Categories

Type a task name and the app detects the category from keywords. Each task shows a colored left stripe and a subtle background tint. Override any detection by clicking the palette icon on hover. Create custom categories with any name, color, and keyword list in Settings. The keyword editor auto-expands to show your full keyword list.

![Editing Categories](screenshots/categories-edit.png)

### Two Layout Options

| Vertical (list) | Horizontal (with time grid) |
|---|---|
| Days stacked top to bottom | Days side by side, with a 24-hour time grid above |
| Scrolls vertically | Time grid for scheduled tasks, unscheduled tasks listed below |
| Clean, focused, minimal | Visual day-planner feel with timeline blocks |
| Best for phones and laptops | Best for wide monitors |

A toggle button in the left sidebar flips between the two layouts in one click.

![Layout options](screenshots/layout-options.png)

### Habits

**Daily habits** show a Mon-Sun checkbox grid. **Weekly habits** are a simple checklist. Habit names persist across weeks; only the checkboxes reset each Monday.

- Double-click any habit name to edit it
- Drag to reorder habits
- **Weekly habit notes**: When you check off a weekly habit, a note input opens so you can record details (e.g., for "try a new recipe" you might write the recipe name). Notes are saved with the habit history and appear as tooltips in the archive view.
- Past week habit progress is visible when navigating backward

### Mood & Notes

A collapsible section below the habits with a 7-face week view. Click any past or current day to pick from 6 mood emojis and add a short note.

- Mood display syncs with the main week navigation
- Days with notes show a speech bubble indicator
- Data is stored per-date so it survives across weeks

![Daily Mood](screenshots/mood.png)

### Journal

Write daily entries with a rich text editor. A mini calendar shows green dots on days you've written.

- **Day header links**: Each day in the planner has a small pencil icon on the left. Click it to jump straight to that day's journal entry. The icon is faint when there's no entry and darker when an entry exists, so you can see your writing history at a glance.
- Mobile shows a feed-style view with 4-line previews of recent entries

![Journal](screenshots/journal.png)

### Rich Text Notebooks

A built-in notes system with multiple notebooks and a full rich text editor.

**Editor toolbar:** bold, italic, underline, strikethrough, highlight colors, text colors, links, images, bullet lists, numbered lists, and tables.

**Dynamic tables:** Insert a 2x2 table, then use toolbar buttons to add or remove rows and columns.

**Image resize:** Click an image to select it (gold border). Drag from the bottom-right corner to resize proportionally.

Notebooks are listed in a collapsible sidebar. Drag to reorder. Double-click to rename.

![Notebooks](screenshots/notebooks.png)

### People and Birthday Reminders

Keep track of people with expandable contact cards: name, birthday, likes, dislikes, relationship, and notes. Searchable.

When you add a birthday to a contact, the app automatically creates an upcoming task reminder that surfaces 2 weeks before the date.

### Archive

Every completed task is logged with its category, assigned date, and completion date. The archive view shows productivity stats (tasks completed in the past 7 and 30 days, weekly average), category breakdowns, habit progress heatmaps for the past 4 weeks, and a separate section for completed projects with their full subtask history.

![Archive](screenshots/archive.png)

### Dark Mode and Light Mode

Full dark and light theme across the entire app. Toggle in Settings.

![Light mode](screenshots/light-mode.png)

### Global Search

Search across everything at once: tasks, completed tasks, upcoming, notebooks, journal entries, contacts, habits, and notes. Results show which section each match came from.

### Undo

Press Ctrl+Z (Cmd+Z on Mac) to undo the last destructive action: task deletion, completion toggle, or upcoming task removal.

### Mobile

On screens under 640px, the app switches to a mobile-optimized layout:

- Bottom navigation bar
- Larger text and bigger checkboxes
- Dedicated Habits tab
- Long-press (500ms) to open context menus
- Feed-style journal view

<p align="center">
  <img src="screenshots/mobile-planner.png" alt="Mobile Planner" width="24%" />
  <img src="screenshots/mobile-habits.png" alt="Mobile Habits" width="24%" />
  <img src="screenshots/mobile-journal.png" alt="Mobile Journal" width="24%" />
  <img src="screenshots/mobile-settings.png" alt="Mobile Settings" width="24%" />
</p>

### Installable PWA

Add to your home screen (phone) or taskbar (desktop) for a native app feel. Works in Chrome, Edge, and Firefox.

---

## Setting Up Cross-Device Sync

The default local mode stores everything in your browser. If you want to sync across multiple devices, you can set up your own Firebase backend:

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Email/Password authentication
3. Create a Firestore database and Storage bucket
4. Clone this repo and add your Firebase config as environment variables
5. Deploy to Vercel (free tier) and connect your GitHub repo
6. Visit your deployment at `/cloud` to enable the synced mode

For full step-by-step instructions, see the **[Setup Guide](SETUP_GUIDE.md)**.

With sync enabled:
- Tasks, habits, notebooks, journal, contacts, categories, moods, projects, and settings all sync across devices
- Firestore persistent local cache lets you edit offline; changes sync when reconnected
- Multiple tabs and devices stay in sync

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), inline styles |
| Local Storage | IndexedDB (default mode) |
| Cloud Storage | Firebase Auth, Firestore, Storage (optional) |
| Hosting | Vercel (free tier) |
| PWA | vite-plugin-pwa, service worker |

---

## Development

```bash
# Install dependencies
npm install

# Start local dev server at http://localhost:5173
npm run dev

# Deploy (after testing locally)
git add .
git commit -m "description of changes"
git push
```

Vercel auto-deploys from GitHub within a minute. Hard refresh (Ctrl+Shift+R) if you see a cached version.

### Project Structure

```
src/
  Planner.jsx          Main app: tasks, habits, mood, projects, settings, layouts
  usePlannerData.js    Firebase data layer, sync, carry-forward, recurring rules
  useLocalData.js      IndexedDB local storage adapter (mirrors usePlannerData interface)
  NotebooksSidebar.jsx Rich text notebooks with tables and image resize
  JournalPanel.jsx     Daily journal with mini calendar
  ContactsPanel.jsx    People/contacts tracker
  App.jsx              Auth mode router (local vs cloud based on URL)
  LoginScreen.jsx      Login/signup screen (cloud mode only)
  useAuth.js           Firebase auth hook
  firebase.js          Firebase config (reads from environment variables)
  main.jsx             Entry point

index.html             HTML shell, viewport, global styles
vite.config.js         Vite + PWA config
vercel.json            Vercel rewrites for /cloud route
SETUP_GUIDE.md         Detailed setup instructions for sync mode
```

---
## License

This project is licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).

You are free to use, modify, and share this project for non-commercial purposes, as long as you give credit and share any modifications under the same license. Commercial use is not permitted without permission from the author.
