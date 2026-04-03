# Weekly Planner

A personal weekly planner and productivity app that syncs across all your devices. Built as a Progressive Web App (PWA) with Firebase for cloud sync.

<!-- Screenshot: Main planner view showing the weekly layout with tasks -->
![Main planner view](screenshots/planner-view.png)

## Features

### Weekly Task Planner
Organize your week with a clean, scrollable day-by-day layout. Add tasks to any day, drag and drop them between days, and check them off when done. Incomplete tasks automatically carry forward to Monday of the next week so nothing gets lost.

<!-- Screenshot: Tasks with category colors visible -->
![Tasks with categories](screenshots/tasks-categories.png)

### Smart Categories
Tasks are automatically color-coded by category based on keywords as you type. The system uses word-boundary matching to prevent false positives ("show" won't match "shower"). You can customize categories with any name, color, and keyword list from Settings.

Default categories: Cleaning, Cooking, Learning, Crafts/Art/Reading, Sporas, Events, Volunteering, Gardening, Self Care, and Other.

### Recurring Tasks
Right-click any task and choose Repeat to make it recurring. Options include:

- **Weekly:** Repeat every week for 2, 4, 8, or 12 weeks, or until a specific date
- **Monthly:** Repeat on the 1st, 15th, or last day of each month, or on a specific weekday pattern (e.g. "3rd Wednesday of every month")

Recurring rules are saved persistently, so they survive even if you check off, delete, or clear the task. They'll keep generating fresh tasks on schedule.

### Later List
A dedicated section for tasks you want to remember but haven't scheduled yet. Tasks in Later are uncategorized by default and get auto-categorized when you drag them into a specific day.

### Upcoming Tasks
Schedule tasks for future weeks with a built-in mini calendar. The calendar shows gold dots on days that have scheduled tasks. Click a day to scroll to and highlight its tasks. When a scheduled week arrives, those tasks automatically move into the planner.

<!-- Screenshot: Upcoming sidebar with mini calendar -->

### Daily and Weekly Habits
Track recurring habits with a checkbox grid. Daily habits show a Mon through Sun row of checkboxes. Weekly habits are a simple checklist. Both reset each week, and the previous week's data is saved to habit history.

Habits can be reordered by dragging and renamed by double-clicking.

<!-- Screenshot: Habits tracker section -->
![Habits tracker](screenshots/habits.png)

### Habit Streaks and Spotlights
A collapsible Streaks section below the habits grid shows:

- **Momentum circles:** SVG rings for each day of the week showing daily completion percentage
- **Pace message:** Comparison against last week's progress
- **Spotlight messages:** Encouragement based on your data, including streak counts, improvement vs. last week, perfect weeks, and today's completion status

### Rich Text Notebooks
A built-in notes system with multiple notebooks. Each has a rich text editor with bold, italic, underline, strikethrough, headings, highlights, text colors, links, images, tables, and dividers. The toolbar includes:

- **Bullet style picker:** Choose between disc, circle, square, or dash bullet styles
- **Indent/outdent** for nested lists
- **Tab key** inserts a tab space, or indents/outdents when inside a list

Tables have right-click context menus for adding/removing rows and columns. Spellcheck is disabled in tables to avoid red squiggles on non-dictionary words. New notes open with the name field focused for immediate editing.

<!-- Screenshot: Notebooks panel with editor -->
![Notebooks](screenshots/notebooks.png)

### Daily Journal
Write daily journal entries with the same rich text editor. Two viewing modes:

- **Editor mode:** Mini calendar sidebar with green dots on days with entries. Click a date to edit that day's entry.
- **Feed mode:** A scrollable timeline of all entries displayed as cards, newest first, similar to a blog feed. Each card shows the date, full formatted weekday, and rendered content. Click the pencil icon to edit any entry.

<!-- Screenshot: Journal panel with calendar -->
![Journal](screenshots/journal.png)

### People / Contacts
Keep track of people in your life with expandable cards. Store names, birthdays, likes, dislikes, relationship labels, and general notes. Fully searchable.

### Global Search
Search across everything: tasks, archive, upcoming tasks, notebooks, journal entries, contacts, quick notes, and habits. Click any result to:

- Navigate directly to the matching view (notes, journal date, contact, archive, etc.)
- Scroll to and highlight the matching text in gold
- Highlights work inside contentEditable editors, regular text, and even textareas
- Dismiss the highlight with any click or keypress

### Task Archive and Productivity Stats
Every completed task is logged in the archive indefinitely with its category, assigned date, and completion date. The archive includes:

**Productivity stats:**
- Tasks completed in the past 7 and 30 days
- Average tasks per week (calculated using actual account age, not a fixed 30-day divisor)
- Category breakdown with color-coded tags

**Habit progress:**
- Per-week progress bars for daily habits
- Heat map grid showing each daily habit's M-T-W-T-F-S-S completion pattern across up to 4 weeks (green dots for done, grey for missed, dash for habits that didn't exist yet)
- Weekly habits detail table showing checkmark/X for each habit per week
- 4-week average completion percentages

### Drag and Drop
HTML5 drag and drop with several refinements:

- Drop zones are invisible normally (2px), expand to 8px when any drag starts, and grow to 20px with a gold dashed border when directly hovered
- Auto-scroll when dragging near the top or bottom edges of the scroll area
- Drop state reliably cleans up via capture-phase listeners and a 3-second timeout fallback

### Automated Backups
The app automatically backs up all your data to Firestore twice daily (around 12 AM and 12 PM). Last 7 backups are kept. You can also:

- **Export JSON** to download a complete backup file to your device
- **View Backups** in Settings to see timestamps and data counts
- **Restore** any backup with a two-step confirmation

### Dark Mode
Full dark theme that applies to every part of the app, including editors, tables, and all UI elements. Toggle in Settings.

<!-- Screenshot: Dark mode view -->
![Dark mode](screenshots/dark-mode.png)

### Layout Options
Switch between a vertical list layout (days stacked top to bottom) and a horizontal column layout (days side by side) in Settings. Your preference syncs across devices.

### Mobile Friendly
On phones (screens under 640px), the app switches to a mobile layout with a bottom navigation bar, larger touch targets, and a simplified single-column view. Portrait orientation is enforced via the PWA manifest.

<!-- Screenshot: Mobile view on phone -->
![Mobile view](screenshots/mobile.png)

### Cross-Device Sync
Sign in with the same account on any device. All tasks, habits, notebooks, journal entries, contacts, and settings sync through Firebase. The sync system uses one-time reads (no real-time listeners) with debounced writes for reliability.

### Installable PWA
Install the app on your home screen (phone) or taskbar (desktop) for a native app-like experience.

## Tech Stack

- **Frontend:** React (Vite), inline styles with CSS variables, no external UI library
- **Backend:** Firebase Authentication, Firestore
- **Hosting:** Vercel (free tier)
- **PWA:** vite-plugin-pwa with service worker

## Getting Started

### Prerequisites
- Node.js 18+
- A Firebase project with Authentication and Firestore enabled

### Running locally

```
npm install
npm run dev
```

This starts a local dev server at `http://localhost:5173`.

### Deploying

Push to GitHub and Vercel auto-deploys within a minute.

```
git add .
git commit -m "description of changes"
git push
```

If the deployed version doesn't update, hard refresh with `Ctrl + Shift + R`.

### Project structure

```
src/
  App.jsx              - Auth wrapper, error state, passes data to Planner
  Planner.jsx          - Main app: tasks, habits, archive, settings, search, drag-and-drop
  usePlannerData.js    - Firebase data layer, sync, carry-forward, backups, recurring rules
  NotebooksSidebar.jsx - Rich text notebooks with toolbar, tables, context menu
  JournalPanel.jsx     - Daily journal with calendar, editor, and feed views
  ContactsPanel.jsx    - People/relationships tracker
  LoginScreen.jsx      - Email/password auth screen
  useAuth.js           - Firebase auth hook
  firebase.js          - Firebase config
  main.jsx             - Entry point
index.html             - HTML shell, global styles, portrait lock
vite.config.js         - Vite + PWA plugin config
ARCHITECTURE.md        - Detailed technical architecture guide
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for an in-depth technical guide covering the data model, sync architecture, component hierarchy, and coding conventions.

## Adding Screenshots

Create a `screenshots/` folder in the project root and save images as:

- `planner-view.png` (main weekly view with tasks)
- `tasks-categories.png` (tasks showing category colors)
- `habits.png` (habits tracker section)
- `notebooks.png` (notebooks panel with editor)
- `journal.png` (journal with calendar or feed view)
- `dark-mode.png` (app in dark mode)
- `mobile.png` (app on a phone screen)

## License

Personal project.
