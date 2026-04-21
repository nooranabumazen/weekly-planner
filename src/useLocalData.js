// useLocalData.js — Local storage adapter (IndexedDB) that mirrors usePlannerData's interface.
// Used when no Firebase auth is present (demo/local mode).

import { useState, useEffect, useCallback, useRef } from 'react';
import { makeTask, formatLocalDate, DEFAULT_CATEGORIES } from './usePlannerData';

const DB_NAME = "weeklyPlannerLocal";
const DB_VERSION = 1;
const STORE = "data";

// ─── IndexedDB helpers ───
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => resolve(null);
  });
}

async function idbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

// ─── Week key helpers (same logic as usePlannerData) ───
const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function getWeekKey(offset = 0) {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7) + offset * 7);
  return formatLocalDate(monday);
}

function getPrevWeekKey() {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7) - 7);
  return formatLocalDate(monday);
}

const emptyTasks = () => ({ mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [], later: [] });

const DEFAULT_DAILY_HABITS = [
  { id: "dh1", name: "Read 20 min", checks: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false } },
  { id: "dh2", name: "Exercise", checks: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false } },
];
const DEFAULT_WEEKLY_HABITS = [
  { id: "wh1", name: "Meal prep", done: false },
  { id: "wh2", name: "Deep clean one room", done: false },
];
const DEFAULT_NOTEBOOKS = [
  { id: "nb1", title: "Books to Read", content: "<p></p>" },
  { id: "nb2", title: "Cool Ideas", content: "<p></p>" },
  { id: "nb3", title: "Things to Cook", content: "<p></p>" },
];

export function useLocalData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const dataRef = useRef(null);
  const saveTimer = useRef(null);
  const weekKeyRef = useRef(getWeekKey());

  // Keep dataRef in sync
  useEffect(() => { dataRef.current = data; }, [data]);

  // ─── Debounced save: writes all data to IDB after 250ms of inactivity ───
  const flushSave = useCallback(() => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    const d = dataRef.current;
    if (!d) return;
    const wk = weekKeyRef.current;
    idbSet("tasks_" + wk, d.tasks);
    idbSet("futureTasks", d.futureTasks);
    idbSet("notebooks", d.notebooks);
    idbSet("journal", d.journal);
    idbSet("contacts", d.contacts);
    idbSet("archive", d.archive);
    idbSet("projects", d.projects);
    idbSet("dailyHabits", { items: d.dailyHabits, _weekKey: wk });
    idbSet("weeklyHabits", { items: d.weeklyHabits, _weekKey: wk });
    idbSet("settings", { categories: d.categories, layout: d.layout, notes: d.notes, darkMode: d.darkMode, taskFontSize: d.taskFontSize });
    idbSet("habitHistory", d.habitHistory);
    idbSet("moods", d.moods);
    idbSet("recurringRules", d.recurringRules);
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, 250);
  }, [flushSave]);

  // ─── Load all data on mount ───
  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      const wk = getWeekKey();
      weekKeyRef.current = wk;

      const [tasksData, futureData, notebooksData, journalData, contactsData, archiveData,
        projectsData, dailyData, weeklyData, settingsData, historyData, moodsData, recurringData] = await Promise.all([
        idbGet("tasks_" + wk), idbGet("futureTasks"), idbGet("notebooks"), idbGet("journal"),
        idbGet("contacts"), idbGet("archive"), idbGet("projects"),
        idbGet("dailyHabits"), idbGet("weeklyHabits"), idbGet("settings"),
        idbGet("habitHistory"), idbGet("moods"), idbGet("recurringRules"),
      ]);

      let tasks = tasksData || emptyTasks();
      const futureTasks = futureData || [];
      const notebooks = notebooksData || DEFAULT_NOTEBOOKS;
      const journal = journalData || {};
      const contacts = contactsData || [];
      const archive = archiveData || [];
      const projects = projectsData || [];
      let dailyHabits = dailyData?.items || DEFAULT_DAILY_HABITS;
      let weeklyHabits = weeklyData?.items || DEFAULT_WEEKLY_HABITS;
      const dailyWeekKey = dailyData?._weekKey || null;
      const weeklyWeekKey = weeklyData?._weekKey || null;
      let habitHistory = historyData || {};
      const moods = moodsData || {};
      const recurringRules = recurringData || [];
      const settings = settingsData || { categories: DEFAULT_CATEGORIES, layout: "vertical", notes: "", darkMode: false };

      // ─── Carry-forward if new week ───
      if (!tasksData && dailyWeekKey && dailyWeekKey !== wk) {
        const prevTasks = await idbGet("tasks_" + dailyWeekKey);
        if (prevTasks) {
          const dayKeys = ["mon","tue","wed","thu","fri","sat","sun"];
          const carry = [];
          dayKeys.forEach((d) => {
            (prevTasks[d] || []).forEach((t) => {
              if (!t.done) carry.push({ ...t, id: "t" + Date.now() + "_" + Math.random().toString(36).slice(2,6), _targetDay: d });
            });
          });
          const newTasks = emptyTasks();
          newTasks.later = prevTasks.later || [];
          carry.forEach((t) => {
            const day = t._targetDay || "mon";
            const { _targetDay, ...clean } = t;
            if (!newTasks[day].some((x) => x.text === clean.text && !x.done)) newTasks[day].push(clean);
          });
          tasks = newTasks;
        }

        // Archive habit history
        habitHistory[dailyWeekKey] = { ...(habitHistory[dailyWeekKey] || {}), daily: dailyHabits.map((h) => ({ id: h.id, name: h.name, checks: { ...h.checks } })) };
        habitHistory[weeklyWeekKey || dailyWeekKey] = { ...(habitHistory[weeklyWeekKey || dailyWeekKey] || {}), weekly: weeklyHabits.map((h) => ({ id: h.id, name: h.name, done: h.done, note: h.note })) };
        // Keep only last 8 weeks
        const sortedKeys = Object.keys(habitHistory).sort().reverse().slice(0, 8);
        const trimmed = {};
        sortedKeys.forEach((k) => { trimmed[k] = habitHistory[k]; });
        habitHistory = trimmed;

        // Reset habits
        dailyHabits = dailyHabits.map((h) => ({ ...h, checks: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false } }));
        weeklyHabits = weeklyHabits.map((h) => ({ ...h, done: false, note: "" }));
      }

      if (cancelled) return;
      setData({
        tasks, futureTasks, notebooks, journal, contacts, archive, projects,
        dailyHabits, weeklyHabits, habitHistory, moods, recurringRules,
        categories: settings.categories || DEFAULT_CATEGORIES,
        layout: settings.layout || "vertical",
        notes: settings.notes || "",
        darkMode: settings.darkMode || false,
        taskFontSize: settings.taskFontSize,
      });
      setLoading(false);
    }
    loadAll();
    return () => { cancelled = true; };
  }, []);

  // ─── Save helpers (mirror usePlannerData interface) ───
  const save = useCallback((newData) => {
    setData(newData);
    dataRef.current = newData;
    scheduleSave();
  }, [scheduleSave]);

  const saveQuiet = save; // Same as save for local mode

  const saveFuture = useCallback((items) => {
    setData((p) => p ? { ...p, futureTasks: items } : p);
    idbSet("futureTasks", items);
  }, []);

  const saveNotebooks = useCallback((items) => {
    setData((p) => p ? { ...p, notebooks: items } : p);
    idbSet("notebooks", items);
  }, []);

  const saveJournal = useCallback((entries) => {
    setData((p) => p ? { ...p, journal: entries } : p);
    idbSet("journal", entries);
  }, []);

  const saveContacts = useCallback((items) => {
    setData((p) => p ? { ...p, contacts: items } : p);
    idbSet("contacts", items);
  }, []);

  const saveArchive = useCallback((items) => {
    setData((p) => p ? { ...p, archive: items } : p);
    idbSet("archive", items);
  }, []);

  const saveProjects = useCallback((items) => {
    setData((p) => p ? { ...p, projects: items } : p);
    idbSet("projects", items);
  }, []);

  const saveDailyHabits = useCallback((items) => {
    setData((p) => p ? { ...p, dailyHabits: items } : p);
    idbSet("dailyHabits", { items, _weekKey: weekKeyRef.current });
  }, []);

  const saveWeeklyHabits = useCallback((items) => {
    setData((p) => p ? { ...p, weeklyHabits: items } : p);
    idbSet("weeklyHabits", { items, _weekKey: weekKeyRef.current });
  }, []);

  const saveSettings = useCallback((s) => {
    setData((p) => p ? { ...p, categories: s.categories, layout: s.layout, notes: s.notes, darkMode: s.darkMode, taskFontSize: s.taskFontSize } : p);
    idbSet("settings", s);
  }, []);

  const saveRecurringRules = useCallback((items) => {
    setData((p) => p ? { ...p, recurringRules: items } : p);
    idbSet("recurringRules", items);
  }, []);

  const saveMoods = useCallback((entries) => {
    setData((p) => p ? { ...p, moods: entries } : p);
    idbSet("moods", entries);
  }, []);

  const loadWeekTasks = useCallback(async (weekKey) => {
    return await idbGet("tasks_" + weekKey);
  }, []);

  const saveWeekTasks = useCallback((weekKey, tasks) => {
    idbSet("tasks_" + weekKey, tasks);
  }, []);

  // ─── Backup system (localStorage-based for local mode) ───
  const getBackups = useCallback(async () => {
    const keys = [];
    for (let i = 0; i < 7; i++) {
      const backup = await idbGet("backup_" + i);
      if (backup) keys.push({ index: i, timestamp: backup.timestamp, label: new Date(backup.timestamp).toLocaleString() });
    }
    return keys.sort((a, b) => b.timestamp - a.timestamp);
  }, []);

  const restoreBackup = useCallback(async (index) => {
    const backup = await idbGet("backup_" + index);
    if (!backup || !backup.data) return false;
    setData(backup.data);
    dataRef.current = backup.data;
    flushSave();
    return true;
  }, [flushSave]);

  // Auto-backup every 12 hours
  useEffect(() => {
    const doBackup = async () => {
      if (!dataRef.current) return;
      const lastStr = localStorage.getItem("local_lastBackup");
      const last = lastStr ? parseInt(lastStr, 10) : 0;
      if (Date.now() - last < 12 * 60 * 60 * 1000) return;
      // Rotate: find the oldest slot
      let oldestIdx = 0, oldestTime = Infinity;
      for (let i = 0; i < 7; i++) {
        const b = await idbGet("backup_" + i);
        if (!b) { oldestIdx = i; break; }
        if (b.timestamp < oldestTime) { oldestTime = b.timestamp; oldestIdx = i; }
      }
      await idbSet("backup_" + oldestIdx, { timestamp: Date.now(), data: dataRef.current });
      localStorage.setItem("local_lastBackup", String(Date.now()));
    };
    doBackup();
  }, [data]);

  const exportData = useCallback(() => {
    if (!dataRef.current) return;
    const blob = new Blob([JSON.stringify(dataRef.current, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "weekly-planner-export.json"; a.click();
    URL.revokeObjectURL(url);
  }, []);

  // Flush on page hide
  useEffect(() => {
    const handler = () => { if (document.visibilityState === "hidden") flushSave(); };
    document.addEventListener("visibilitychange", handler);
    window.addEventListener("beforeunload", flushSave);
    return () => { document.removeEventListener("visibilitychange", handler); window.removeEventListener("beforeunload", flushSave); };
  }, [flushSave]);

  return { data, loading, save, saveQuiet, saveFuture, saveNotebooks, saveJournal, saveContacts, saveArchive, saveProjects, saveDailyHabits, saveWeeklyHabits, saveSettings, saveRecurringRules, saveMoods, loadWeekTasks, saveWeekTasks, getBackups, restoreBackup, exportData };
}
