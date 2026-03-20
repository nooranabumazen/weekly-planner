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

const defaultData = () => ({
  tasks: emptyTasks(),
  futureTasks: [],
  dailyHabits: DEFAULT_DAILY_HABITS,
  weeklyHabits: DEFAULT_WEEKLY_HABITS,
  notes: "",
});

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

export function usePlannerData(userId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const latestTasksRef = useRef(null);
  const weekKeyRef = useRef(getWeekKey());
  const saveTimer = useRef(null);

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
      if (weekDoc && weekDoc.tasks) {
        tasks = weekDoc.tasks;
      } else {
        const prevDoc = await readDoc(`users/${userId}/weeks/${getPrevWeekKey()}`);
        if (prevDoc && prevDoc.tasks) {
          const pt = prevDoc.tasks;
          const carry = [];
          ["mon","tue","wed","thu","fri","sat","sun"].forEach((d) => {
            (pt[d] || []).forEach((t) => { if (!t.done) carry.push({ ...t, id: "t" + Date.now() + "_" + Math.random().toString(36).slice(2,6) }); });
          });
          tasks = { mon: carry, tue: [], wed: [], thu: [], fri: [], sat: [], sun: [], later: pt.later || [] };
        } else {
          tasks = emptyTasks();
        }
        writeDoc(weekPath, { tasks, _lastModified: Date.now() });
      }

      const futureTasks = futureDoc?.items || [];
      const defaultNB = [{ id: "nb1", title: "Books to Read", content: "<p></p>" }, { id: "nb2", title: "Cool Ideas", content: "<p></p>" }, { id: "nb3", title: "Things to Cook", content: "<p></p>" }];
      const notebooks = notebooksDoc?.items || defaultNB;
      const journal = journalDoc?.entries || {};
      const contacts = contactsDoc?.items || [];
      const archive = archiveDoc?.items || [];
      const dailyHabits = dailyDoc?.items || DEFAULT_DAILY_HABITS;
      const weeklyHabits = weeklyDoc?.items || DEFAULT_WEEKLY_HABITS;
      const settings = settingsDoc || { categories: DEFAULT_CATEGORIES, layout: "vertical", notes: "", darkMode: false };

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

  // ─── Reload tasks when page becomes visible (switching back from another app/tab) ───
  useEffect(() => {
    if (!userId) return;
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      const wk = getWeekKey();
      if (wk !== weekKeyRef.current) { window.location.reload(); return; }
      const weekDoc = await readDoc(`users/${userId}/weeks/${wk}`);
      if (weekDoc?.tasks) {
        latestTasksRef.current = weekDoc.tasks;
        setData((prev) => prev ? { ...prev, tasks: weekDoc.tasks } : prev);
      }
      // Also reload meta docs
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
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [userId]);

  // ─── Save tasks with short debounce ───
  const save = useCallback((newData) => {
    if (newData.tasks) latestTasksRef.current = newData.tasks;
    setData(newData);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
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

  // ─── Flush pending save on page hide ───
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        if (latestTasksRef.current) writeDoc(`users/${userId}/weeks/${weekKeyRef.current}`, { tasks: latestTasksRef.current, _lastModified: Date.now() });
      }
    };
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", flush);
    return () => { document.removeEventListener("visibilitychange", onHide); window.removeEventListener("beforeunload", flush); };
  }, [userId]);

  // ─── Meta saves (immediate, no debounce) ───
  const saveFuture = useCallback((items) => { setData((p) => p ? { ...p, futureTasks: items } : p); writeDoc(`users/${userId}/meta/futureTasks`, { items }); }, [userId]);
  const saveNotebooks = useCallback((items) => { setData((p) => p ? { ...p, notebooks: items } : p); writeDoc(`users/${userId}/meta/notebooks`, { items }); }, [userId]);
  const saveJournal = useCallback((entries) => { setData((p) => p ? { ...p, journal: entries } : p); writeDoc(`users/${userId}/meta/journal`, { entries }); }, [userId]);
  const saveContacts = useCallback((items) => { setData((p) => p ? { ...p, contacts: items } : p); writeDoc(`users/${userId}/meta/contacts`, { items }); }, [userId]);
  const saveArchive = useCallback((items) => { setData((p) => p ? { ...p, archive: items } : p); writeDoc(`users/${userId}/meta/archive`, { items }); }, [userId]);
  const saveDailyHabits = useCallback((items) => { setData((p) => p ? { ...p, dailyHabits: items } : p); writeDoc(`users/${userId}/meta/dailyHabits`, { items }); }, [userId]);
  const saveWeeklyHabits = useCallback((items) => { setData((p) => p ? { ...p, weeklyHabits: items } : p); writeDoc(`users/${userId}/meta/weeklyHabits`, { items }); }, [userId]);
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
