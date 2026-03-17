# Weekly Planner

A personal weekly planner and productivity app that syncs across all your devices. Built as a Progressive Web App (PWA) with Firebase for real-time cloud sync.

<!-- Replace with your own screenshot of the main planner view -->
![Main planner view](screenshots/planner-view.png)

## Features

### Weekly Task Planner
Organize your week with a clean, scrollable day-by-day view. Add tasks to any day, drag and drop them between days, and check them off when done. Tasks that aren't completed by the end of the week automatically carry forward to Monday of the next week.

<!-- Replace with a screenshot showing tasks with category colors -->
![Tasks with categories](screenshots/tasks-categories.png)

### Smart Categories
Tasks are automatically color-coded by category based on keywords. Type "cook dinner" and it detects Cooking. Type "water the plants" and it picks Gardening. You can also manually assign categories, create your own custom categories with any name and color, and manage everything from the Settings tab.

Default categories: Cleaning, Cooking, Learning, Crafts/Art/Reading, Sporas, Events, Volunteering, Gardening, and Other.

### Later List
A dedicated section for tasks you want to remember but haven't scheduled yet. Tasks in Later are uncategorized by default and get auto-categorized when you drag them into a specific day.

### Upcoming Tasks
Schedule tasks for future weeks. When a scheduled week arrives, those tasks automatically move to the correct day in your planner.

### Daily and Weekly Habits
Track recurring habits with a checkbox grid. Daily habits show a Mon through Sun row of checkboxes. Weekly habits are a simple checklist that resets each week. Habit names persist across weeks, only the checkboxes reset.

<!-- Replace with a screenshot of the habits tracker section -->
![Habits tracker](screenshots/habits.png)

### Rich Text Notebooks
A built-in notes system with multiple notebooks. Each notebook has a rich text editor supporting bold, italic, underline, strikethrough, highlights, text colors, links, tables, lists, and image pasting. Notebooks are listed in a collapsible sidebar that you can drag to reorder.

<!-- Replace with a screenshot of the notebooks panel -->
![Notebooks](screenshots/notebooks.png)

### Daily Journal
Write daily journal entries with the same rich text editor. A mini calendar on the side shows green dots on days with entries, making it easy to navigate your history.

<!-- Replace with a screenshot of the journal panel -->
![Journal](screenshots/journal.png)

### People / Contacts
Keep track of people in your life with expandable cards. Store names, birthdays, likes, dislikes, relationship notes, and general notes. Searchable and always accessible.

### Task Archive
Every task you complete gets logged in the archive with its category, assigned date, and completion date. The last 500 completed tasks are kept for reference.

### Dark Mode
Full dark theme that applies to every part of the app. Toggle it in Settings and it syncs across devices.

<!-- Replace with a screenshot of the app in dark mode -->
![Dark mode](screenshots/dark-mode.png)

### Layout Options
Switch between a vertical list layout (days stacked top to bottom) and a horizontal column layout (days side by side) in Settings. Your preference syncs across devices.

### Mobile Friendly
On phones (screens under 640px), the app automatically switches to a mobile layout with a bottom navigation bar, larger text and touch targets, and a simplified single-column view.

<!-- Replace with a screenshot of the app on a phone -->
![Mobile view](screenshots/mobile.png)

### Cross-Device Sync
Sign in with the same account on your phone, laptop, tablet, or any device with a browser. All your tasks, habits, notebooks, journal entries, contacts, and settings sync in real time through Firebase.

### Installable PWA
Install the app on your home screen (phone) or taskbar (desktop) for a native app-like experience. Works in Chrome, Edge, and Firefox on Windows.

## Tech Stack

- **Frontend:** React (Vite), inline styles, no external UI library
- **Backend:** Firebase (Authentication, Firestore, Storage)
- **Hosting:** Vercel (free tier)
- **PWA:** vite-plugin-pwa with service worker for offline caching

## Quick Start

To get the app running, you'll need Node.js, a Firebase account (free), and a GitHub account (free). The basic steps are:

1. Set up a Firebase project with Authentication and Firestore
2. Clone the repo and add your Firebase config to `src/firebase.js`
3. Run `npm install` then `npm run dev` to test locally
4. Push to GitHub and connect to Vercel for free hosting
5. Install on your devices as a PWA

For detailed step-by-step instructions, see the [Setup Guide](SETUP_GUIDE.md).

## Development

### Running locally

```
npm install
npm run dev
```

This starts a local dev server at `http://localhost:5173`. Always test changes locally with `npm run dev` before deploying.

### Deploying changes

```
git add .
git commit -m "description of changes"
git push
```

Vercel automatically deploys from GitHub within about a minute.

### Project structure

```
src/
  App.jsx              - Auth wrapper, passes data to Planner
  Planner.jsx          - Main app: task management, habits, settings, layout
  usePlannerData.js    - Firebase data layer, sync logic, carry-forward
  NotebooksSidebar.jsx - Rich text notebooks with drag-to-reorder
  JournalPanel.jsx     - Daily journal with mini calendar
  ContactsPanel.jsx    - People/relationships tracker
  LoginScreen.jsx      - Email/password auth screen
  useAuth.js           - Firebase auth hook
  firebase.js          - Firebase config (your project credentials)
  main.jsx             - Entry point
index.html             - HTML shell with viewport and global styles
vite.config.js         - Vite + PWA plugin config
SETUP_GUIDE.md         - Detailed setup and deployment instructions
```

## Adding Screenshots

To add screenshots to this README:

1. Create a `screenshots/` folder in the project root
2. Take screenshots of the app and save them as:
   - `planner-view.png` (main weekly view with some tasks)
   - `tasks-categories.png` (close-up of tasks showing category colors)
   - `habits.png` (the habits tracker section)
   - `notebooks.png` (notebooks panel with the editor open)
   - `journal.png` (journal with calendar sidebar)
   - `dark-mode.png` (the app in dark mode)
   - `mobile.png` (the app on a phone screen)
3. The image references in this README will automatically pick them up
4. Commit the screenshots folder and push to GitHub

## License

This is a personal project. You own it completely. Do whatever you want with it.
