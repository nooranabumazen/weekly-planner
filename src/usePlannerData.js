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

const READ_ERROR = Symbol("READ_ERROR");

async function readDoc(path) {
  try {
    const snap = await getDoc(doc(db, path));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error("Read error:", path, err);
    return READ_ERROR; // Distinct from null (doc doesn't exist)
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

      // If ANY read returned an error (not null, but READ_ERROR), refuse to proceed.
      // This prevents writing defaults over real data when the network is down.
      const allReads = [weekDoc, futureDoc, notebooksDoc, journalDoc, contactsDoc, archiveDoc, dailyDoc, weeklyDoc, settingsDoc];
      const hadError = allReads.some((r) => r === READ_ERROR);
      if (hadError) {
        console.error("One or more Firestore reads failed. Not loading to prevent data loss.");
        // Show error state, user should refresh
        setData(null);
        setLoading(false);
        return;
      }

      let tasks;
      let isNewWeek = false;
      if (weekDoc && weekDoc.tasks) {
        tasks = weekDoc.tasks;
      } else {
        isNewWeek = true;
        const prevDoc = await readDoc(`users/${userId}/weeks/${getPrevWeekKey()}`);
        if (prevDoc === READ_ERROR) {
          // Can't read previous week, abort entirely to prevent data loss
          console.error("Failed to read previous week for carry-forward. Aborting load.");
          setData(null);
          setLoading(false);
          return;
        }
        if (prevDoc && prevDoc.tasks) {
          const pt = prevDoc.tasks;
          const carry = [];
          const dayKeys = ["mon","tue","wed","thu","fri","sat","sun"];

          // Carry forward incomplete non-done tasks + generate recurring tasks
          dayKeys.forEach((d) => {
            (pt[d] || []).forEach((t) => {
              if (!t.done) {
                carry.push({ ...t, id: "t" + Date.now() + "_" + Math.random().toString(36).slice(2,6) });
              }
              // If task has a recurring rule, generate a new copy for this week
              if (t.recurring) {
                const rule = t.recurring;
                let shouldRepeat = false;
                let newRule = null;
                if (rule.type === "weeks" && rule.count > 1) {
                  shouldRepeat = true;
                  newRule = { ...rule, count: rule.count - 1 };
                } else if (rule.type === "until" && rule.until >= wk) {
                  shouldRepeat = true;
                  newRule = rule;
                }
                if (shouldRepeat) {
                  const day = rule.day || d;
                  const newTask = { id: "t" + Date.now() + "_" + Math.random().toString(36).slice(2,6), text: t.text, done: false, category: t.category || "cat_none", recurring: newRule };
                  // Check if already carried forward (avoid duplicate)
                  if (!carry.some((c) => c.text === t.text && !c.done)) {
                    if (dayKeys.includes(day)) {
                      // Will be placed in the right day below
                      carry.push({ ...newTask, _targetDay: day });
                    } else {
                      carry.push(newTask);
                    }
                  } else {
                    // Update recurring rule on the carried-forward copy
                    const existing = carry.find((c) => c.text === t.text && !c.done);
                    if (existing) existing.recurring = newRule;
                  }
                }
              }
            });
          });

          // Sort carry items into their target days
          const newTasks = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [], later: pt.later || [] };
          carry.forEach((t) => {
            if (t._targetDay && dayKeys.includes(t._targetDay)) {
              const { _targetDay, ...clean } = t;
              newTasks[_targetDay].push(clean);
            } else {
              newTasks.mon.push(t); // default: incomplete tasks go to Monday
            }
          });

          // Also handle recurring in later
          (pt.later || []).forEach((t) => {
            if (t.recurring) {
              const rule = t.recurring;
              let shouldRepeat = false;
              let newRule = null;
              if (rule.type === "weeks" && rule.count > 1) { shouldRepeat = true; newRule = { ...rule, count: rule.count - 1 }; }
              else if (rule.type === "until" && rule.until >= wk) { shouldRepeat = true; newRule = rule; }
              if (shouldRepeat && !newTasks.later.some((c) => c.text === t.text)) {
                newTasks.later.push({ id: "t" + Date.now() + "_" + Math.random().toString(36).slice(2,6), text: t.text, done: false, category: t.category || "cat_none", recurring: newRule });
              }
            }
          });

          tasks = newTasks;
          writeDoc(weekPath, { tasks, _lastModified: Date.now() });
        } else {
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

      // Read habit history
      const historyDoc = await readDoc(m("habitHistory"));
      if (historyDoc === READ_ERROR) {
        console.error("Failed to read habit history. Aborting load.");
        setData(null);
        setLoading(false);
        return;
      }
      let habitHistory = historyDoc?.weeks || {};

      // Reset habit checks if we're in a new week (only if habit docs exist)
      // If _weekKey is null (first time with this feature), just stamp the current week without resetting
      if (dailyDoc && dailyWeekKey === null) {
        writeDoc(m("dailyHabits"), { items: dailyHabits, _weekKey: wk });
      } else if (dailyDoc && dailyWeekKey !== wk) {
        // Save snapshot of previous week before resetting
        habitHistory[dailyWeekKey] = {
          ...(habitHistory[dailyWeekKey] || {}),
          daily: dailyHabits.map((h) => ({ id: h.id, name: h.name, checks: { ...h.checks } })),
        };
        // Keep only last 8 weeks of history
        const sortedKeys = Object.keys(habitHistory).sort().reverse().slice(0, 8);
        const trimmed = {};
        sortedKeys.forEach((k) => { trimmed[k] = habitHistory[k]; });
        habitHistory = trimmed;
        writeDoc(m("habitHistory"), { weeks: habitHistory });

        dailyHabits = dailyHabits.map((h) => ({ ...h, checks: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false } }));
        writeDoc(m("dailyHabits"), { items: dailyHabits, _weekKey: wk });
      }
      if (weeklyDoc && weeklyWeekKey === null) {
        writeDoc(m("weeklyHabits"), { items: weeklyHabits, _weekKey: wk });
      } else if (weeklyDoc && weeklyWeekKey !== wk) {
        habitHistory[weeklyWeekKey] = {
          ...(habitHistory[weeklyWeekKey] || {}),
          weekly: weeklyHabits.map((h) => ({ id: h.id, name: h.name, done: h.done })),
        };
        const sortedKeys = Object.keys(habitHistory).sort().reverse().slice(0, 8);
        const trimmed = {};
        sortedKeys.forEach((k) => { trimmed[k] = habitHistory[k]; });
        habitHistory = trimmed;
        writeDoc(m("habitHistory"), { weeks: habitHistory });

        weeklyHabits = weeklyHabits.map((h) => ({ ...h, done: false }));
        writeDoc(m("weeklyHabits"), { items: weeklyHabits, _weekKey: wk });
      }
      const settings = settingsDoc || { categories: DEFAULT_CATEGORIES, layout: "vertical", notes: "", darkMode: false };

      // Only write defaults for a TRULY NEW USER (all meta docs are null)
      // If some docs exist but others don't, the missing ones were probably deleted intentionally or haven't been created yet
      const metaDocs = [notebooksDoc, journalDoc, contactsDoc, archiveDoc, dailyDoc, weeklyDoc, settingsDoc];
      const allMetaNull = metaDocs.every((d) => d === null);
      if (allMetaNull && !isNewWeek) {
        // Brand new user: write all defaults
        writeDoc(m("notebooks"), { items: notebooks });
        writeDoc(m("journal"), { entries: journal });
        writeDoc(m("contacts"), { items: contacts });
        writeDoc(m("archive"), { items: archive });
        writeDoc(m("dailyHabits"), { items: dailyHabits, _weekKey: wk });
        writeDoc(m("weeklyHabits"), { items: weeklyHabits, _weekKey: wk });
        writeDoc(m("settings"), settings);
      }

      latestTasksRef.current = tasks;

      if (!cancelled) {
        setData({ tasks, futureTasks, notebooks, journal, contacts, archive, dailyHabits, weeklyHabits, habitHistory,
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
