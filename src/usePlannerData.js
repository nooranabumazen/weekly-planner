import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

let _id = 0;
export function makeTask(text, opts = {}) {
  return { id: "t" + Date.now() + "_" + ++_id, text, done: false, ...opts };
}

export function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getWeekKey() {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));
  return formatLocalDate(monday);
}

export function getWeekDates() {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));
  return DAYS.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      label,
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      fullDate: formatLocalDate(d),
      isToday: d.toDateString() === today.toDateString(),
    };
  });
}

export function getUpcomingDates() {
  const today = new Date();
  const day = today.getDay();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() + (7 - ((day + 6) % 7)));
  const dates = [];
  for (let i = 1; i <= 21; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    dates.push({
      label: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      fullDate: formatLocalDate(d),
    });
  }
  return dates;
}

const DEFAULT_DAILY_HABITS = [
  { id: "dh1", name: "Read 20 min", checks: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false } },
  { id: "dh2", name: "Exercise", checks: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false } },
  { id: "dh3", name: "Journal", checks: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false } },
];

const DEFAULT_WEEKLY_HABITS = [
  { id: "wh1", name: "Meal prep", done: false },
  { id: "wh2", name: "Deep clean one room", done: false },
  { id: "wh3", name: "Call family", done: false },
];

const emptyTasks = () => ({ mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [], later: [] });

function getPrevWeekKey() {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));
  const prevMonday = new Date(monday);
  prevMonday.setDate(monday.getDate() - 7);
  return formatLocalDate(prevMonday);
}

async function readDoc(path) {
  try {
    const snap = await getDoc(doc(db, path));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error("Read error:", path, err);
    return null;
  }
}

function writeDoc(path, data) {
  setDoc(doc(db, path), data).catch((err) => console.error("Write error:", path, err));
}

// Synchronous write using sendBeacon for page unload reliability
function writeDocSync(path, data) {
  // Use regular setDoc - sendBeacon doesn't work with Firestore SDK
  setDoc(doc(db, path), data).catch((err) => console.error("Write error:", path, err));
}

export function usePlannerData(userId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const latestTasksRef = useRef(null);
  const weekKeyRef = useRef(getWeekKey());
  const saveTimer = useRef(null);
  const hasPendingSave = useRef(false);
  const lastHiddenAt = useRef(0);

  // ─── Flush: cancel debounce timer and write immediately ───
  const flushSave = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (hasPendingSave.current && latestTasksRef.current) {
      hasPendingSave.current = false;
      writeDocSync(`users/${userId}/weeks/${weekKeyRef.current}`, { tasks: latestTasksRef.current, _lastModified: Date.now() });
    }
  }, [userId]);

  // ─── Load all data once on mount ───
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function loadAll() {
      const wk = getWeekKey();
      weekKeyRef.current = wk;
      const weekPath = `users/${userId}/weeks/${wk}`;
      const m = (name) => `users/${userId}/meta/${name}`;

      const [weekDoc, futureDoc, notebooksDoc, journalDoc, contactsDoc, archiveDoc, dailyDoc, weeklyDoc, settingsDoc] = await Promise.all([
        readDoc(weekPath), readDoc(m("futureTasks")), readDoc(m("notebooks")), readDoc(m("journal")),
        readDoc(m("contacts")), readDoc(m("archive")), readDoc(m("dailyHabits")), readDoc(m("weeklyHabits")), readDoc(m("settings")),
      ]);

      if (cancelled) return;

      let tasks;
      let isNewWeek = false;
      if (weekDoc && weekDoc.tasks) {
        tasks = weekDoc.tasks;
      } else {
        isNewWeek = true;
        // New week or first time: try carry forward
        const prevDoc = await readDoc(`users/${userId}/weeks/${getPrevWeekKey()}`);
        if (prevDoc && prevDoc.tasks) {
          const pt = prevDoc.tasks;
          const carry = [];
          ["mon","tue","wed","thu","fri","sat","sun"].forEach((d) => {
            (pt[d] || []).forEach((t) => { if (!t.done) carry.push({ ...t, id: "t" + Date.now() + "_" + Math.random().toString(36).slice(2,6) }); });
          });
          tasks = { mon: carry, tue: [], wed: [], thu: [], fri: [], sat: [], sun: [], later: pt.later || [] };
          // Only write the new week doc if we actually carried tasks forward
          writeDoc(weekPath, { tasks, _lastModified: Date.now() });
        } else {
          // Truly empty - use in memory only, don't write an empty doc to Firestore
          tasks = emptyTasks();
        }
      }

      const futureTasks = futureDoc?.items || [];
      const defaultNB = [{ id: "nb1", title: "Books to Read", content: "<p></p>" }, { id: "nb2", title: "Cool Ideas", content: "<p></p>" }, { id: "nb3", title: "Things to Cook", content: "<p></p>" }];
      const notebooks = notebooksDoc?.items || defaultNB;
      const journal = journalDoc?.entries || {};
      const contacts = contactsDoc?.items || [];
      const archive = archiveDoc?.items || [];
      let dailyHabits = dailyDoc?.items || DEFAULT_DAILY_HABITS;
      let weeklyHabits = weeklyDoc?.items || DEFAULT_WEEKLY_HABITS;
      const dailyWeekKey = dailyDoc?._weekKey || null;
      const weeklyWeekKey = weeklyDoc?._weekKey || null;

      // Reset habit checks if we're in a new week
      if (dailyWeekKey !== wk) {
        dailyHabits = dailyHabits.map((h) => ({ ...h, checks: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false } }));
        writeDoc(m("dailyHabits"), { items: dailyHabits, _weekKey: wk });
      }
      if (weeklyWeekKey !== wk) {
        weeklyHabits = weeklyHabits.map((h) => ({ ...h, done: false }));
        writeDoc(m("weeklyHabits"), { items: weeklyHabits, _weekKey: wk });
      }
      const settings = settingsDoc || { categories: DEFAULT_CATEGORIES, layout: "vertical", notes: "", darkMode: false };

      // Reset habit checks on new week
      if (isNewWeek) {
        dailyHabits = dailyHabits.map((h) => ({ ...h, checks: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false } }));
        weeklyHabits = weeklyHabits.map((h) => ({ ...h, done: false }));
        writeDoc(m("dailyHabits"), { items: dailyHabits });
        writeDoc(m("weeklyHabits"), { items: weeklyHabits });
      }

      if (!notebooksDoc) writeDoc(m("notebooks"), { items: notebooks });
      if (!journalDoc) writeDoc(m("journal"), { entries: journal });
      if (!contactsDoc) writeDoc(m("contacts"), { items: contacts });
      if (!archiveDoc) writeDoc(m("archive"), { items: archive });
      if (!dailyDoc) writeDoc(m("dailyHabits"), { items: dailyHabits });
      if (!weeklyDoc) writeDoc(m("weeklyHabits"), { items: weeklyHabits });
      if (!settingsDoc) writeDoc(m("settings"), settings);

      latestTasksRef.current = tasks;

      if (!cancelled) {
        setData({ tasks, futureTasks, notebooks, journal, contacts, archive, dailyHabits, weeklyHabits,
          categories: settings.categories, layout: settings.layout, notes: settings.notes, darkMode: settings.darkMode });
        setLoading(false);
      }
    }

    loadAll();
    return () => { cancelled = true; };
  }, [userId]);

  // ─── On visibility change: flush on hide, reload on show (only if away > 5s) ───
  useEffect(() => {
    if (!userId) return;

    const handler = async () => {
      if (document.visibilityState === "hidden") {
        // Page going away: flush any pending save immediately
        lastHiddenAt.current = Date.now();
        flushSave();
        return;
      }

      // Page becoming visible again
      const awayFor = Date.now() - lastHiddenAt.current;

      // If week changed while away, full reload
      const wk = getWeekKey();
      if (wk !== weekKeyRef.current) {
        window.location.reload();
        return;
      }

      // Only reload from Firestore if we were away for more than 5 seconds
      // This prevents the revert bug when quickly switching tabs
      if (awayFor < 5000) return;

      // Flush first to make sure our latest state is in Firestore
      flushSave();

      // Small delay to let the flush write complete
      await new Promise((r) => setTimeout(r, 500));

      // Now read the latest from Firestore (could include changes from another device)
      const weekDoc = await readDoc(`users/${userId}/weeks/${wk}`);
      if (weekDoc?.tasks) {
        latestTasksRef.current = weekDoc.tasks;
        setData((prev) => prev ? { ...prev, tasks: weekDoc.tasks } : prev);
      }
      const [futureDoc, archiveDoc, dailyDoc, weeklyDoc] = await Promise.all([
        readDoc(`users/${userId}/meta/futureTasks`), readDoc(`users/${userId}/meta/archive`),
        readDoc(`users/${userId}/meta/dailyHabits`), readDoc(`users/${userId}/meta/weeklyHabits`),
      ]);
      setData((prev) => {
        if (!prev) return prev;
        return { ...prev,
          futureTasks: futureDoc?.items || prev.futureTasks,
          archive: archiveDoc?.items || prev.archive,
          dailyHabits: dailyDoc?.items || prev.dailyHabits,
          weeklyHabits: weeklyDoc?.items || prev.weeklyHabits,
        };
      });
    };

    document.addEventListener("visibilitychange", handler);
    window.addEventListener("beforeunload", flushSave);
    return () => {
      document.removeEventListener("visibilitychange", handler);
      window.removeEventListener("beforeunload", flushSave);
    };
  }, [userId, flushSave]);

  // ─── Save tasks with short debounce ───
  const save = useCallback((newData) => {
    if (newData.tasks) latestTasksRef.current = newData.tasks;
    setData(newData);
    hasPendingSave.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      hasPendingSave.current = false;
      const tasks = latestTasksRef.current;
      if (tasks) writeDoc(`users/${userId}/weeks/${weekKeyRef.current}`, { tasks, _lastModified: Date.now() });
    }, 250);
  }, [userId]);

  const saveQuiet = useCallback((newData) => {
    if (newData.tasks) latestTasksRef.current = newData.tasks;
    setData(newData);
    const tasks = newData.tasks || latestTasksRef.current;
    if (tasks) writeDoc(`users/${userId}/weeks/${weekKeyRef.current}`, { tasks, _lastModified: Date.now() });
  }, [userId]);

  // ─── Meta saves (immediate) ───
  const saveFuture = useCallback((items) => { setData((p) => p ? { ...p, futureTasks: items } : p); writeDoc(`users/${userId}/meta/futureTasks`, { items }); }, [userId]);
  const saveNotebooks = useCallback((items) => { setData((p) => p ? { ...p, notebooks: items } : p); writeDoc(`users/${userId}/meta/notebooks`, { items }); }, [userId]);
  const saveJournal = useCallback((entries) => { setData((p) => p ? { ...p, journal: entries } : p); writeDoc(`users/${userId}/meta/journal`, { entries }); }, [userId]);
  const saveContacts = useCallback((items) => { setData((p) => p ? { ...p, contacts: items } : p); writeDoc(`users/${userId}/meta/contacts`, { items }); }, [userId]);
  const saveArchive = useCallback((items) => { setData((p) => p ? { ...p, archive: items } : p); writeDoc(`users/${userId}/meta/archive`, { items }); }, [userId]);
  const saveDailyHabits = useCallback((items) => { setData((p) => p ? { ...p, dailyHabits: items } : p); writeDoc(`users/${userId}/meta/dailyHabits`, { items, _weekKey: weekKeyRef.current }); }, [userId]);
  const saveWeeklyHabits = useCallback((items) => { setData((p) => p ? { ...p, weeklyHabits: items } : p); writeDoc(`users/${userId}/meta/weeklyHabits`, { items, _weekKey: weekKeyRef.current }); }, [userId]);
  const saveSettings = useCallback((s) => { setData((p) => p ? { ...p, categories: s.categories, layout: s.layout, notes: s.notes, darkMode: s.darkMode } : p); writeDoc(`users/${userId}/meta/settings`, s); }, [userId]);

  return { data, loading, save, saveQuiet, saveFuture, saveNotebooks, saveJournal, saveContacts, saveArchive, saveDailyHabits, saveWeeklyHabits, saveSettings };
}

export const DEFAULT_CATEGORIES = [
  { id: "cat_cleaning", name: "Cleaning", color: "#B7D5E8" },
  { id: "cat_cooking", name: "Cooking", color: "#E8C9B7" },
  { id: "cat_learning", name: "Learning", color: "#D5E8B7" },
  { id: "cat_crafts", name: "Crafts/Art/Reading", color: "#D5B7E8" },
  { id: "cat_sporas", name: "Sporas", color: "#E8B7D5" },
  { id: "cat_events", name: "Events", color: "#B7E8D5" },
  { id: "cat_volunteering", name: "Volunteering", color: "#E8D5B7" },
  { id: "cat_gardening", name: "Gardening", color: "#c8e8b0" },
  { id: "cat_none", name: "Other", color: "#e0ddd6" },
];
