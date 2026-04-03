# Weekly Planner

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?logo=firebase&logoColor=white)](https://firebase.google.com)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000?logo=vercel)](https://vercel.com)
[![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Vite](https://img.shields.io/badge/Vite-Build-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)

A personal weekly planner and productivity PWA with cloud sync, habit tracking, rich text notebooks, journaling, and more. Zero external UI libraries.

![Main planner view](screenshots/planner-view.png)

---

## At a Glance

| Feature | Description |
|:---|:---|
| **Task Planner** | Drag-and-drop weekly tasks with auto-carry-forward for incomplete items |
| **Recurring Tasks** | Weekly (2/4/8/12w), until-date, and monthly (1st, 15th, last day, nth weekday) |
| **Smart Categories** | Auto-detect category by keywords with word-boundary matching |
| **Daily/Weekly Habits** | Checkbox grid with streak tracking, momentum circles, and spotlight messages |
| **Rich Text Notebooks** | Bold, italic, highlights, tables, images, bullet style picker, indent/outdent |
| **Daily Journal** | Editor + scrollable feed view with date cards |
| **Global Search** | Search everything, click to navigate, DOM-based gold highlighting |
| **Archive + Analytics** | Unlimited task history, habit heat maps, progress bars, 4-week averages |
| **Automated Backups** | Twice-daily Firestore snapshots + manual JSON export and restore |
| **People Tracker** | Contacts with birthdays, likes/dislikes, relationship notes |
| **Dark Mode** | Full theme with 12 CSS variables, syncs across devices |
| **Cross-Device Sync** | Firebase Auth + Firestore, debounced writes, visibility-change refresh |
| **Mobile PWA** | Responsive layout, bottom nav, portrait lock, installable on any device |

---

## Features

### Task Management

**Weekly Planner** with vertical (list) or horizontal (column) layouts. Add tasks to any day, drag and drop between days, and check them off. Incomplete tasks carry forward to Monday automatically.

**Smart Categories** auto-detect as you type using word-boundary regex. "shower" won't match "show". Customize category names, colors, and keyword lists in Settings.

**Later List** for unscheduled tasks. Drag into a day to auto-categorize.

**Upcoming Tasks** with a mini calendar showing gold dots on days with scheduled tasks. Click a date to scroll to and highlight its tasks. Tasks auto-promote to the planner when their week arrives.

![Tasks with categories](screenshots/tasks-categories.png)

### Recurring Tasks

Right-click any task to set up recurring schedules:

| Type | Options | Behavior |
|:---|:---|:---|
| **Weekly** | Every week for 2, 4, 8, or 12 weeks | Count decrements each week |
| **Until Date** | Repeat until a specific date | Expires after the date |
| **Monthly** | 1st of month, 15th, last day, or nth weekday (e.g. 3rd Wednesday) | Repeats forever, placed on the correct day |

Rules are saved persistently, so they survive checking off, deleting, or clearing tasks.

### Habits and Streaks

**Daily Habits**: Mon-Sun checkbox grid with faint row separators for visual clarity. Reorder by dragging, rename by double-clicking.

**Weekly Habits**: Simple checklist that resets each week.

**Streaks Section** (collapsible): Momentum circles for each day, pace comparison vs. last week, and spotlight messages including streak counts, improvement tracking, perfect weeks, and "all habits done today" encouragement.

![Habits tracker](screenshots/habits.png)

### Rich Text Notebooks

Full editor toolbar with formatting, colors, links, images, tables, and a bullet style picker (disc, circle, square, dash). Tab key inserts tab spaces or indents lists. Tables have right-click context menus for row/column management. Spellcheck is disabled in tables. New notes auto-focus the name field for immediate editing.

![Notebooks](screenshots/notebooks.png)

### Daily Journal

Two viewing modes:

| Mode | Description |
|:---|:---|
| **Editor** | Mini calendar sidebar with green entry dots. Click any date to write or edit. |
| **Feed** | Scrollable timeline of entry cards with date badges, formatted weekdays, and rendered content. |

Toggle between modes with a single click. "What's on your mind today?" prompt when no entry exists for today.

![Journal](screenshots/journal.png)

### Global Search

Searches across tasks, archive, notebooks, journal, contacts, quick notes, and habits. Click any result to:
- Navigate to the matching view
- Scroll to and highlight the match in gold (DOM TreeWalker-based)
- Works inside contentEditable, textareas, and all rendered text
- Dismiss with any click or keypress

### Archive and Analytics

All completed tasks stored indefinitely. The archive dashboard includes:

| Stat | Details |
|:---|:---|
| **Productivity** | Tasks completed in 7/30 days, avg/week (uses actual account age) |
| **Category Breakdown** | Color-coded tags showing task distribution |
| **Daily Habit Heat Map** | Per-habit M-T-W-T-F-S-S dots across 4 weeks (green = done, grey = missed, dash = didn't exist yet) |
| **Weekly Habit Detail** | Checkmark/X per habit per week |
| **Progress Bars** | Per-week daily completion with integrated bar chart |
| **4-Week Averages** | Daily and weekly habit completion percentages |

### Backup and Restore

| Method | Details |
|:---|:---|
| **Auto Backup** | Twice daily (~12 AM and ~12 PM), 10-hour throttle in localStorage, max 7 kept |
| **Manual Export** | Download complete JSON backup to your device |
| **Restore** | Browse backups in Settings, see timestamps and data counts, two-step confirmation |

### Other Features

- **Dark Mode** with 12 CSS variables for full theme coverage
- **People/Contacts** tracker with expandable cards, search, and birthday storage
- **Drag and Drop** with context-aware drop zones (2px normal, 8px during drag, 20px on hover) and auto-scroll near edges
- **Mobile Layout** with bottom nav, large touch targets, portrait lock
- **Installable PWA** on phone home screen or desktop taskbar
- **Cross-Device Sync** via Firebase with debounced writes, visibility-change refresh, and data-loss prevention

---

## Tech Stack

| Layer | Technology |
|:---|:---|
| Frontend | React 18 (Vite), inline styles, CSS variables |
| Backend | Firebase Auth + Firestore |
| Hosting | Vercel (free tier, auto-deploy from GitHub) |
| PWA | vite-plugin-pwa, service worker |
| Fonts | DM Sans (body), JetBrains Mono (labels) |
| External Libraries | None (no UI framework, no CSS library) |

---

## Project Structure

```
src/
  Planner.jsx          ~2300 lines   Main app: tasks, habits, archive, settings, search, drag-and-drop
  usePlannerData.js     ~640 lines   Firebase data layer, sync, carry-forward, backups, recurring rules
  NotebooksSidebar.jsx  ~640 lines   Rich text editor, toolbar, tables, context menu
  JournalPanel.jsx      ~370 lines   Journal with calendar, editor, and feed views
  ContactsPanel.jsx     ~130 lines   People/relationships tracker
  App.jsx                ~80 lines   Auth wrapper, error state
  LoginScreen.jsx       ~110 lines   Email/password auth
  useAuth.js             ~35 lines   Firebase auth hook
  firebase.js            ~40 lines   Firebase config
  main.jsx                ~8 lines   Entry point
index.html                           HTML shell, global CSS, portrait lock
vite.config.js                       Vite + PWA config
ARCHITECTURE.md                      Detailed technical architecture guide
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full technical deep-dive: data model, sync architecture, component hierarchy, and coding conventions.

---

## Quick Start

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Deploy (auto-deploys via Vercel on push)
git add . && git commit -m "changes" && git push
```

Requires Node.js 18+, a Firebase project with Auth and Firestore, and a Vercel account connected to GitHub.

---

## Screenshots

Create a `screenshots/` folder and add:

| Filename | Content |
|:---|:---|
| `planner-view.png` | Main weekly view with tasks |
| `tasks-categories.png` | Tasks showing category colors |
| `habits.png` | Habits tracker section |
| `notebooks.png` | Notebooks with editor open |
| `journal.png` | Journal (calendar or feed view) |
| `dark-mode.png` | App in dark mode |
| `mobile.png` | App on a phone screen |

---

## License

Personal project.
