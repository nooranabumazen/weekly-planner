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

function getWeekKey(offset = 0) {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7) + offset * 7);
  return formatLocalDate(monday);
}

export function getWeekDates(offset = 0) {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7) + offset * 7);
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

// Check if a monthly recurring rule should generate a task this week, and which day
function checkMonthlyRule(rule, weekStartDate) {
  // weekStartDate is a Date object for Monday of this week
  const dayKeys = ["mon","tue","wed","thu","fri","sat","sun"];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStartDate);
    d.setDate(d.getDate() + i);
    const dayOfMonth = d.getDate();
    const dow = d.getDay(); // 0=Sun, 6=Sat
    const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const weekNum = Math.ceil(dayOfMonth / 7); // 1st, 2nd, 3rd, etc.

    let match = false;
    if (rule.pattern === "day_of_month" && dayOfMonth === rule.dayOfMonth) match = true;
    if (rule.pattern === "last_day" && dayOfMonth === lastDayOfMonth) match = true;
    if (rule.pattern === "nth_weekday" && dow === rule.weekday && weekNum === rule.nth) match = true;

    if (match) return dayKeys[i]; // return which day of the week to place it
  }
  return null; // not this week
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

      const [weekDoc, futureDoc, notebooksDoc, journalDoc, contactsDoc, archiveDoc, dailyDoc, weeklyDoc, settingsDoc, recurringDoc, projectsDoc] = await Promise.all([
        readDoc(weekPath), readDoc(m("futureTasks")), readDoc(m("notebooks")), readDoc(m("journal")),
        readDoc(m("contacts")), readDoc(m("archive")), readDoc(m("dailyHabits")), readDoc(m("weeklyHabits")), readDoc(m("settings")),
        readDoc(m("recurringRules")), readDoc(m("projects")),
      ]);

      if (cancelled) return;

      // If ANY read returned an error (not null, but READ_ERROR), refuse to proceed.
      // This prevents writing defaults over real data when the network is down.
      const allReads = [weekDoc, futureDoc, notebooksDoc, journalDoc, contactsDoc, archiveDoc, dailyDoc, weeklyDoc, settingsDoc, recurringDoc, projectsDoc];
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
        // Even on existing week, check persistent recurring rules for missing tasks
        const rules = recurringDoc?.items || [];
        if (rules.length > 0) {
          const dayKeys = ["mon","tue","wed","thu","fri","sat","sun"];
          let changed = false;
          for (const rule of rules) {
            let shouldRepeat = false;
            let targetDay = null;
            if (rule.type === "weeks" && rule.count >= 1) { shouldRepeat = true; }
            else if (rule.type === "until" && rule.until >= wk) { shouldRepeat = true; }
            else if (rule.type === "monthly") {
              const weekStart = new Date(wk + "T12:00:00");
              targetDay = checkMonthlyRule(rule, weekStart);
              if (targetDay) shouldRepeat = true;
            }
            if (shouldRepeat) {
              const day = targetDay || rule.day || "mon";
              if (dayKeys.includes(day)) {
                const alreadyExists = tasks[day]?.some((t) => t.text === rule.text);
                if (!alreadyExists) {
                  if (!tasks[day]) tasks[day] = [];
                  tasks[day].push({ id: "t" + Date.now() + "_" + Math.random().toString(36).slice(2,6), text: rule.text, done: false, category: rule.category || "cat_none", recurring: { ...rule } });
                  changed = true;
                }
              }
            }
          }
          if (changed) {
            writeDoc(weekPath, { tasks, _lastModified: Date.now() });
          }
        }
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
                carry.push({ ...t, id: "t" + Date.now() + "_" + Math.random().toString(36).slice(2,6), _targetDay: d });
              }
              // If task has a recurring rule, generate a new copy for this week
              if (t.recurring) {
                const rule = t.recurring;
                let shouldRepeat = false;
                let newRule = null;
                let targetDay = null;
                if (rule.type === "weeks" && rule.count >= 1) {
                  shouldRepeat = true;
                  newRule = rule.count > 1 ? { ...rule, count: rule.count - 1 } : null;
                } else if (rule.type === "until" && rule.until >= wk) {
                  shouldRepeat = true;
                  newRule = rule;
                } else if (rule.type === "monthly") {
                  const weekStart = new Date(wk + "T12:00:00");
                  targetDay = checkMonthlyRule(rule, weekStart);
                  if (targetDay) { shouldRepeat = true; newRule = { ...rule }; }
                }
                if (shouldRepeat) {
                  const day = targetDay || rule.day || d;
                  const newTask = { id: "t" + Date.now() + "_" + Math.random().toString(36).slice(2,6), text: t.text, done: false, category: t.category || "cat_none", recurring: newRule || undefined };
                  // Check if already carried forward (avoid duplicate)
                  const existing = carry.find((c) => c.text === t.text && !c.done);
                  if (!existing) {
                    if (dayKeys.includes(day)) {
                      carry.push({ ...newTask, _targetDay: day });
                    } else {
                      carry.push(newTask);
                    }
                  } else {
                    // Update recurring rule on the carried-forward copy
                    existing.recurring = newRule || undefined;
                  }
                }
              }
            });
          });

          // Sort carry items into their target days (incomplete tasks stay on their original weekday)
          // Check if next week already has tasks (from forward navigation)
          const existingDoc = await readDoc(weekPath);
          const existingTasks = (existingDoc && existingDoc !== READ_ERROR && existingDoc.tasks) ? existingDoc.tasks : null;
          const newTasks = existingTasks
            ? { mon: [...(existingTasks.mon || [])], tue: [...(existingTasks.tue || [])], wed: [...(existingTasks.wed || [])], thu: [...(existingTasks.thu || [])], fri: [...(existingTasks.fri || [])], sat: [...(existingTasks.sat || [])], sun: [...(existingTasks.sun || [])], later: [...(existingTasks.later || []), ...(pt.later || [])] }
            : { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [], later: pt.later || [] };
          carry.forEach((t) => {
            const day = (t._targetDay && dayKeys.includes(t._targetDay)) ? t._targetDay : "mon";
            const { _targetDay, ...clean } = t;
            // Avoid duplicates: skip if same text already exists on the same day
            if (!newTasks[day].some((x) => x.text === clean.text && !x.done)) {
              newTasks[day].push(clean);
            }
          });

          // Also handle recurring in later
          (pt.later || []).forEach((t) => {
            if (t.recurring) {
              const rule = t.recurring;
              let shouldRepeat = false;
              let newRule = null;
              if (rule.type === "weeks" && rule.count >= 1) { shouldRepeat = true; newRule = rule.count > 1 ? { ...rule, count: rule.count - 1 } : null; }
              else if (rule.type === "until" && rule.until >= wk) { shouldRepeat = true; newRule = rule; }
              else if (rule.type === "monthly") {
                const weekStart = new Date(wk + "T12:00:00");
                const targetDay = checkMonthlyRule(rule, weekStart);
                if (targetDay) { shouldRepeat = true; newRule = { ...rule }; }
              }
              if (shouldRepeat && !newTasks.later.some((c) => c.text === t.text)) {
                newTasks.later.push({ id: "t" + Date.now() + "_" + Math.random().toString(36).slice(2,6), text: t.text, done: false, category: t.category || "cat_none", recurring: newRule || undefined });
              }
            }
          });

          // Also generate tasks from persistent recurring rules (survives task deletion)
          const rules = recurringDoc?.items || [];
          const updatedRules = [];
          for (const rule of rules) {
            let shouldRepeat = false;
            let newRule = null;
            let targetDay = null;
            if (rule.type === "weeks" && rule.count >= 1) {
              shouldRepeat = true;
              newRule = rule.count > 1 ? { ...rule, count: rule.count - 1 } : null;
            } else if (rule.type === "until" && rule.until >= wk) {
              shouldRepeat = true;
              newRule = { ...rule };
            } else if (rule.type === "monthly") {
              const weekStart = new Date(wk + "T12:00:00");
              targetDay = checkMonthlyRule(rule, weekStart);
              if (targetDay) { shouldRepeat = true; newRule = { ...rule }; }
            }
            if (shouldRepeat) {
              const day = targetDay || rule.day || "mon";
              const existing = dayKeys.includes(day) ? newTasks[day].some((t) => t.text === rule.text) : newTasks.later.some((t) => t.text === rule.text);
              if (!existing) {
                const newTask = { id: "t" + Date.now() + "_" + Math.random().toString(36).slice(2,6), text: rule.text, done: false, category: rule.category || "cat_none", recurring: newRule || undefined };
                if (dayKeys.includes(day)) newTasks[day].push(newTask);
                else newTasks.later.push(newTask);
              }
              if (newRule) updatedRules.push(newRule);
            }
            // Monthly rules persist forever, weekly/until rules expire when done
            if (!shouldRepeat && rule.type === "monthly") updatedRules.push(rule);
          }
          writeDoc(m("recurringRules"), { items: updatedRules });

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
      const projects = projectsDoc?.items || [];
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
      // Read moods (date-keyed mood + note tracker)
      const moodsDoc = await readDoc(m("moods"));
      const moods = (moodsDoc && moodsDoc !== READ_ERROR) ? (moodsDoc.entries || {}) : {};
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
        setData({ tasks, futureTasks, notebooks, journal, contacts, archive, projects, dailyHabits, weeklyHabits, habitHistory, moods,
          categories: settings.categories, layout: settings.layout, notes: settings.notes, darkMode: settings.darkMode, taskFontSize: settings.taskFontSize,
          recurringRules: recurringDoc?.items || [] });
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
  const saveSettings = useCallback((s) => { setData((p) => p ? { ...p, categories: s.categories, layout: s.layout, notes: s.notes, darkMode: s.darkMode, taskFontSize: s.taskFontSize } : p); writeDoc(`users/${userId}/meta/settings`, s); }, [userId]);
  const saveRecurringRules = useCallback((items) => { writeDoc(`users/${userId}/meta/recurringRules`, { items }); }, [userId]);
  const saveMoods = useCallback((entries) => { setData((p) => p ? { ...p, moods: entries } : p); writeDoc(`users/${userId}/meta/moods`, { entries }); }, [userId]);
  const saveProjects = useCallback((items) => { setData((p) => p ? { ...p, projects: items } : p); writeDoc(`users/${userId}/meta/projects`, { items }); }, [userId]);

  // ─── Non-current week read/write ───
  const loadWeekTasks = useCallback(async (weekKey) => {
    if (!userId) return null;
    const doc = await readDoc(`users/${userId}/weeks/${weekKey}`);
    if (doc && doc !== READ_ERROR && doc.tasks) return doc.tasks;
    return null;
  }, [userId]);

  const saveWeekTasks = useCallback((weekKey, tasks) => {
    if (!userId) return;
    writeDoc(`users/${userId}/weeks/${weekKey}`, { tasks, _lastModified: Date.now() });
  }, [userId]);

  // ─── Backup System ───
  const MAX_BACKUPS = 7;

  const getLastBackupTime = () => { try { return parseInt(localStorage.getItem("planner_lastBackup") || "0", 10); } catch { return 0; } };
  const setLastBackupTime = (t) => { try { localStorage.setItem("planner_lastBackup", String(t)); } catch {} };

  const createBackup = useCallback(async () => {
    if (!userId || !latestTasksRef.current) return;
    const now = Date.now();
    // Don't backup more than once per 10 hours
    if (now - getLastBackupTime() < 36000000) return;
    setLastBackupTime(now);

    try {
      // Read all current data from Firestore for a complete snapshot
      const m = (name) => `users/${userId}/meta/${name}`;
      const [futureDoc, notebooksDoc, journalDoc, contactsDoc, archiveDoc, dailyDoc, weeklyDoc, settingsDoc, historyDoc] = await Promise.all([
        readDoc(m("futureTasks")), readDoc(m("notebooks")), readDoc(m("journal")),
        readDoc(m("contacts")), readDoc(m("archive")), readDoc(m("dailyHabits")),
        readDoc(m("weeklyHabits")), readDoc(m("settings")), readDoc(m("habitHistory")),
      ]);
      // Don't backup if any read failed
      if ([futureDoc, notebooksDoc, journalDoc, contactsDoc, archiveDoc, dailyDoc, weeklyDoc, settingsDoc].some((d) => d === READ_ERROR)) return;

      const backup = {
        timestamp: now,
        weekKey: weekKeyRef.current,
        tasks: latestTasksRef.current,
        futureTasks: futureDoc?.items || [],
        notebooks: notebooksDoc?.items || [],
        journal: journalDoc?.entries || {},
        contacts: contactsDoc?.items || [],
        archive: archiveDoc?.items || [],
        dailyHabits: dailyDoc?.items || [],
        weeklyHabits: weeklyDoc?.items || [],
        habitHistory: historyDoc?.weeks || {},
        settings: settingsDoc || {},
      };

      // Write backup
      writeDoc(`users/${userId}/backups/${now}`, backup);

      // Clean up old backups: read backup list, delete oldest if > MAX_BACKUPS
      const { getDocs: getDocsQuery, collection, query, orderBy, limit } = await import('firebase/firestore');
      const backupsRef = collection(db, `users/${userId}/backups`);
      const allBackups = await getDocsQuery(query(backupsRef, orderBy("timestamp", "desc")));
      const toDelete = [];
      let count = 0;
      allBackups.forEach((d) => { count++; if (count > MAX_BACKUPS) toDelete.push(d.ref); });
      const { deleteDoc: delDoc } = await import('firebase/firestore');
      for (const ref of toDelete) { delDoc(ref).catch(console.error); }
    } catch (err) {
      console.error("Backup error:", err);
    }
  }, [userId]);

  const getBackups = useCallback(async () => {
    if (!userId) return [];
    try {
      const { getDocs: getDocsQuery, collection, query, orderBy } = await import('firebase/firestore');
      const backupsRef = collection(db, `users/${userId}/backups`);
      const snap = await getDocsQuery(query(backupsRef, orderBy("timestamp", "desc")));
      const list = [];
      snap.forEach((d) => {
        const data = d.data();
        const taskCount = data.tasks ? Object.values(data.tasks).flat().length : 0;
        const notebookCount = data.notebooks?.length || 0;
        const contactCount = data.contacts?.length || 0;
        const archiveCount = data.archive?.length || 0;
        list.push({ id: d.id, timestamp: data.timestamp, weekKey: data.weekKey, taskCount, notebookCount, contactCount, archiveCount });
      });
      return list;
    } catch (err) {
      console.error("Get backups error:", err);
      return [];
    }
  }, [userId]);

  const restoreBackup = useCallback(async (backupId) => {
    if (!userId) return false;
    try {
      const backup = await readDoc(`users/${userId}/backups/${backupId}`);
      if (!backup || backup === READ_ERROR) return false;

      const m = (name) => `users/${userId}/meta/${name}`;
      // Write everything back
      if (backup.tasks) writeDoc(`users/${userId}/weeks/${backup.weekKey || weekKeyRef.current}`, { tasks: backup.tasks, _lastModified: Date.now() });
      if (backup.futureTasks) writeDoc(m("futureTasks"), { items: backup.futureTasks });
      if (backup.notebooks) writeDoc(m("notebooks"), { items: backup.notebooks });
      if (backup.journal) writeDoc(m("journal"), { entries: backup.journal });
      if (backup.contacts) writeDoc(m("contacts"), { items: backup.contacts });
      if (backup.archive) writeDoc(m("archive"), { items: backup.archive });
      if (backup.dailyHabits) writeDoc(m("dailyHabits"), { items: backup.dailyHabits, _weekKey: backup.weekKey || weekKeyRef.current });
      if (backup.weeklyHabits) writeDoc(m("weeklyHabits"), { items: backup.weeklyHabits, _weekKey: backup.weekKey || weekKeyRef.current });
      if (backup.settings) writeDoc(m("settings"), backup.settings);
      if (backup.habitHistory) writeDoc(m("habitHistory"), { weeks: backup.habitHistory });

      // Reload the page to pick up restored data
      setTimeout(() => window.location.reload(), 500);
      return true;
    } catch (err) {
      console.error("Restore error:", err);
      return false;
    }
  }, [userId]);

  const exportData = useCallback(() => {
    if (!data) return;
    const exportObj = {
      exportedAt: new Date().toISOString(),
      weekKey: weekKeyRef.current,
      ...data,
    };
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  // Auto-backup twice daily: around 12 AM and 12 PM
  // Checks every 5 minutes if inside a backup window. 10-hour throttle ensures max 2/day.
  useEffect(() => {
    if (!userId) return;
    const checkBackup = () => {
      if (!data || !latestTasksRef.current) return;
      const now = new Date();
      const hour = now.getHours();
      const min = now.getMinutes();
      // Backup window: 11:30 PM to 12:30 AM, or 11:30 AM to 12:30 PM
      const inWindow = (hour === 23 && min >= 30) || hour === 0 || (hour === 11 && min >= 30) || hour === 12;
      if (inWindow) createBackup();
    };
    const interval = setInterval(checkBackup, 300000); // Check every 5 min
    return () => clearInterval(interval);
  }, [userId, data !== null, createBackup]);

  return { data, loading, save, saveQuiet, saveFuture, saveNotebooks, saveJournal, saveContacts, saveArchive, saveProjects, saveDailyHabits, saveWeeklyHabits, saveSettings, saveRecurringRules, saveMoods, loadWeekTasks, saveWeekTasks, getBackups, restoreBackup, exportData };
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
