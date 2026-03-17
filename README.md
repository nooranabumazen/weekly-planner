# Weekly Planner

**A personal productivity app that keeps your week organized across every device.**

Plan your tasks, track habits, write journal entries, manage contacts, and take notes, all in one place. Built as a Progressive Web App with real-time Firebase sync.

<!-- Replace with your own screenshot -->
![Main planner view](screenshots/planner-view.png)

---

## At a Glance

| Feature | What it does |
|---|---|
| **Weekly Tasks** | Drag-and-drop tasks across days. Incomplete tasks carry forward automatically. |
| **Smart Categories** | Auto-detects task type from keywords and color-codes it. Fully customizable. |
| **Two Layouts** | Vertical list or horizontal columns. Switch anytime in Settings. |
| **Habits** | Daily checkbox grid (Mon-Sun) and weekly checklist. Editable, resizable. |
| **Notebooks** | Rich text editor with dynamic tables, images, highlights, and color. |
| **Journal** | Daily entries with a mini calendar showing your writing history. |
| **People** | Contact cards with birthdays that auto-generate upcoming reminders. |
| **Dark Mode** | Full dark theme across every screen. Syncs with your preference. |
| **Mobile** | Responsive layout with bottom nav, large touch targets, and a dedicated habits tab. |
| **Sync** | Real-time across all devices via Firebase. |

---

## Features

### Task Management

Organize your week with drag-and-drop. Add tasks to any day, reorder them, and check them off. Done tasks fade and sink below a separator. Anything unfinished at the end of the week carries forward to Monday automatically.

**Later list** holds tasks you haven't scheduled yet. They stay uncategorized until you drag them into a day, at which point the category is auto-detected.

**Upcoming sidebar** lets you schedule tasks for future weeks. They auto-promote to the correct day when that week arrives. Press Enter to save quickly.

<!-- Replace with a screenshot showing tasks with category colors -->
![Tasks with categories](screenshots/tasks-categories.png)

### Smart Categories

Type a task name and the app detects the category from keywords:

| You type... | Detected as |
|---|---|
| "cook dinner" | Cooking |
| "vacuum living room" | Cleaning |
| "water the garden" | Gardening |
| "sporas meeting" | Sporas |
| "volunteer at market" | Volunteering |
| "study for exam" | Learning |

Each task shows a colored left stripe and a subtle background tint. Override any detection by clicking the palette icon on hover. Create custom categories with any name and color from a 32-color palette in Settings.

### Two Layout Options

| Vertical (list) | Horizontal (columns) |
|---|---|
| Days stacked top to bottom | Days side by side |
| Scrolls vertically | Scrolls horizontally if columns are wide |
| Clean, focused, minimal | Classic weekly planner feel |
| Best for phones and laptops | Best for wide monitors |

In horizontal mode, drag the edge between any two columns to resize all columns at once. Your layout preference syncs across devices.

<!-- Replace with a screenshot showing horizontal column layout -->
![Layout options](screenshots/layout-options.png)

### Habits

**Daily habits** show a Mon through Sun checkbox grid. **Weekly habits** are a simple checklist. Habit names persist across weeks; only the checkboxes reset each Monday.

- Double-click any habit name to edit it
- Drag the divider between daily and weekly sections to resize
- On mobile, habits get their own tab with large, tappable checkboxes

<!-- Replace with a screenshot of the habits tracker -->
![Habits tracker](screenshots/habits.png)

### Rich Text Notebooks

A built-in notes system with multiple notebooks and a full rich text editor.

**Editor toolbar:** bold, italic, underline, strikethrough, highlight colors, text colors, links, images, bullet lists, numbered lists, and tables.

**Dynamic tables:** Insert a 2x2 table, then use toolbar buttons to add or remove rows and columns. Drag cell edges to resize column widths. Hover highlights which cell you're in.

Notebooks are listed in a collapsible sidebar. Drag to reorder. Double-click to rename.

<!-- Replace with a screenshot of the notebooks panel -->
![Notebooks](screenshots/notebooks.png)

### Journal

Write daily entries with the same rich text editor. A mini calendar shows green dots on days you've written, making it easy to look back. The calendar sidebar collapses if you want full-width writing space.

<!-- Replace with a screenshot of the journal -->
![Journal](screenshots/journal.png)

### People and Birthday Reminders

Keep track of people with expandable contact cards: name, birthday, likes, dislikes, relationship, and notes. Searchable.

When you add a birthday to a contact, the app automatically creates an upcoming task reminder dated on their actual birthday. The reminder only appears in the Upcoming sidebar starting 2 weeks before the date, so it surfaces at just the right time.

### Archive

Every completed task is logged with its category, assigned date, and completion date. The last 500 are kept for reference.

### Dark Mode

Full dark theme across the entire app, including all tabs, editors, popups, and mobile views. Toggle in Settings. Syncs across devices.

<!-- Replace with a screenshot in dark mode -->
![Dark mode](screenshots/dark-mode.png)

### Resizable Sections

The Later and Notes sections at the bottom of the planner have drag handles. Pull up to expand, push down to shrink. Each has a sensible minimum so it doesn't collapse.

### Global Search

Search across everything at once: tasks, completed tasks, upcoming, notebooks, journal entries, contacts, habits, and notes. Results show which section each match came from.

### Mobile

On screens under 640px, the app switches to a mobile-optimized layout:

- Bottom navigation bar
- Larger text (16px) and bigger checkboxes
- Dedicated Habits tab with tappable checkboxes
- Vertical list layout (always)
- Later and Notes inline at the bottom
- Inputs sized to prevent iOS auto-zoom

<!-- Replace with a screenshot on a phone -->
![Mobile view](screenshots/mobile.png)

### Cross-Device Sync

Sign in on your phone, laptop, tablet, or anything with a browser. Tasks, habits, notebooks, journal, contacts, categories, and settings all sync in real time.

### Installable PWA

Add to your home screen (phone) or taskbar (desktop) for a native app feel. Works in Chrome, Edge, and Firefox on Windows.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), inline styles |
| Backend | Firebase Auth, Firestore, Storage |
| Hosting | Vercel (free tier) |
| PWA | vite-plugin-pwa, service worker |

---

## Quick Start

1. Set up a Firebase project with Authentication and Firestore
2. Clone the repo and add your Firebase config to `src/firebase.js`
3. Run `npm install` then `npm run dev` to test locally
4. Push to GitHub and connect to Vercel for free hosting
5. Install on your devices as a PWA

For full step-by-step instructions, see the **[Setup Guide](SETUP_GUIDE.md)**.

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

Vercel auto-deploys from GitHub within a minute. Hard refresh (`Ctrl+Shift+R`) if you see a cached version.

### Project Structure

```
src/
  Planner.jsx          Main app: tasks, habits, settings, layout
  usePlannerData.js    Firebase data layer, sync, carry-forward
  NotebooksSidebar.jsx Rich text notebooks with tables
  JournalPanel.jsx     Daily journal with mini calendar
  ContactsPanel.jsx    People/contacts tracker
  App.jsx              Auth wrapper
  LoginScreen.jsx      Login/signup screen
  useAuth.js           Firebase auth hook
  firebase.js          Your Firebase config
  main.jsx             Entry point

index.html             HTML shell, viewport, global styles
vite.config.js         Vite + PWA config
SETUP_GUIDE.md         Detailed setup instructions
```

---

## Screenshots

To add your own screenshots, create a `screenshots/` folder and save images with these names:

| Filename | What to capture |
|---|---|
| `planner-view.png` | Main weekly view with tasks |
| `tasks-categories.png` | Tasks showing category color stripes |
| `layout-options.png` | Horizontal column layout |
| `habits.png` | Habits section with daily and weekly |
| `notebooks.png` | Notebook editor, ideally with a table |
| `journal.png` | Journal with calendar sidebar visible |
| `dark-mode.png` | Any view in dark mode |
| `mobile.png` | The app on a phone |

Then commit and push. GitHub renders them automatically.

---

## License

This is a personal project. You own it completely. Do whatever you want with it.
